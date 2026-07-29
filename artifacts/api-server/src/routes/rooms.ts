import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db, roomsTable, participantsTable, usersTable, questionBankTable } from "@workspace/db";
import {
  CreateRoomBody,
  GetRoomParams,
  JoinRoomParams,
  JoinRoomBody,
  GetRoomMessagesParams,
  ChooseWinnerParams,
  ChooseWinnerBody,
  MatchRoomBody,
} from "@workspace/api-zod";
import { getIo } from "../socket";
import {
  createGameSession,
  getJoinableRooms,
  getRoomById,
  joinGameSession,
  verifyChooser,
} from "../services/gameSessionService";
import { createMatchSession } from "../services/matchmakingService";
import {
  advanceRound,
  chooseWinner,
  eliminateSuitor,
} from "../services/gameFlowService";
import { getRoomMessagesForUser } from "../services/messagingService";
import { recordQuestionRated } from "../services/questionTelemetryService";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
};

const RoomCreationBody = CreateRoomBody.extend({
  maxSuitors: z.number().int().min(3).max(6).optional(),
  numberOfRounds: z.number().int().optional(),
  questionConfig: z
    .object({
      packStrategy: z
        .union([
          z.object({ mode: z.literal("single"), packSlug: z.string().min(1) }),
          z.object({ mode: z.literal("multi"), packSlugs: z.array(z.string().min(1)).min(1) }),
          z.object({ mode: z.literal("weighted"), packWeights: z.record(z.string(), z.number().min(0)) }),
          z.object({ mode: z.literal("seasonal"), seasonalPackSlugs: z.array(z.string().min(1)).min(1), fallbackPackSlugs: z.array(z.string().min(1)).optional() }),
          z.object({ mode: z.literal("premium"), premiumPackSlugs: z.array(z.string().min(1)).min(1), fallbackPackSlugs: z.array(z.string().min(1)).min(1) }),
        ])
        .optional(),
      categoryWeights: z.object({
        general: z.number().min(0).optional(),
        fun: z.number().min(0).optional(),
        deep: z.number().min(0).optional(),
      }).partial().optional(),
      difficultyPlan: z.array(z.enum(["easy", "medium", "hard", "wildcard"])) .min(1).optional(),
      avoidRecentGames: z.number().int().min(0).max(20).optional(),
      disallowRepeatsInGame: z.boolean().optional(),
    })
    .optional(),
});

const MatchRoomCreationBody = MatchRoomBody.extend({
  maxSuitors: z.number().int().min(3).max(6).optional(),
  numberOfRounds: z.number().int().optional(),
  questionConfig: RoomCreationBody.shape.questionConfig,
});

const RateQuestionBody = z.object({
  rating: z.number().int().min(1).max(5),
});

router.post("/rooms", async (req, res) => {
  const body = RoomCreationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { chooserName, maxSuitors, numberOfRounds, questionConfig } = body.data;
  const { roomData } = await createGameSession(chooserName, maxSuitors, numberOfRounds, questionConfig);
  res.status(201).json(roomData);
});

router.post("/rooms/match", requireAuth, async (req: any, res) => {
  const body = MatchRoomCreationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { chooserUserId, maxSuitors, numberOfRounds, questionConfig } = body.data;

  if (typeof chooserUserId !== "string" || !chooserUserId) {
    res.status(400).json({ error: "chooserUserId is required" });
    return;
  }

  const callerUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, req.clerkUserId),
  });
  if (!callerUser || callerUser.id !== chooserUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const { roomData, chooserParticipantId } = await createMatchSession(chooserUserId, maxSuitors, numberOfRounds, questionConfig);
    res.status(201).json({ ...roomData, chooserParticipantId });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Chooser user not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err.message === "Chooser has no personality vector") {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    res.status(500).json({ error: "Could not create match session" });
  }
});

router.get("/rooms/active", async (_req, res) => {
  const rooms = await getJoinableRooms();
  res.json(rooms);
});

router.get("/rooms/:id", async (req, res) => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room id" });
    return;
  }

  const roomData = await getRoomById(params.data.id);
  if (!roomData) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json(roomData);
});

router.post("/rooms/:id/join", async (req, res) => {
  const params = JoinRoomParams.safeParse(req.params);
  const body = JoinRoomBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const joiningClerkId = getAuth(req)?.userId ?? null;

  try {
    const { participantId, roomData } = await joinGameSession(
      params.data.id,
      body.data.role,
      body.data.name,
      joiningClerkId,
    );
    res.json({ participantId, room: roomData });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Room not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      if (
        err.message === "Room has ended" ||
        err.message === "Room already has a chooser" ||
        err.message === "Room is full"
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    res.status(500).json({ error: "Could not join room" });
  }
});

router.get("/rooms/:id/messages", requireAuth, async (req: any, res) => {
  const params = GetRoomMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room id" });
    return;
  }

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, req.clerkUserId),
  });
  if (!user) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const messages = await getRoomMessagesForUser(params.data.id, user.id);
    res.json(messages);
  } catch (err) {
    res.status(403).json({ error: "Forbidden" });
  }
});

router.post("/rooms/:id/eliminate", requireAuth, async (req: any, res) => {
  const { participantId } = req.body;
  if (typeof participantId !== "string" || !participantId) {
    res.status(400).json({ error: "participantId is required" });
    return;
  }

  const verified = await verifyChooser(req.params.id, req.clerkUserId);
  if (!verified) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const roomData = await eliminateSuitor(req.params.id, participantId);
    res.json(roomData);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Room not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      if (
        err.message === "Already eliminated" ||
        err.message === "Participant not found in this room"
      ) {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    res.status(500).json({ error: "Could not eliminate suitor" });
  }
});

router.post("/rooms/:id/advance-round", requireAuth, async (req: any, res) => {
  const verified = await verifyChooser(req.params.id, req.clerkUserId);
  if (!verified) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const roomData = await advanceRound(req.params.id);
    res.json(roomData);
  } catch (err) {
    if (err instanceof Error && err.message === "Room not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Could not advance round" });
  }
});

router.post("/rooms/:id/choose", requireAuth, async (req: any, res) => {
  const params = ChooseWinnerParams.safeParse(req.params);
  const body = ChooseWinnerBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const verified = await verifyChooser(params.data.id, req.clerkUserId);
  if (!verified) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const roomData = await chooseWinner(params.data.id, body.data.winnerId);
    res.json(roomData);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Room not found") {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err.message === "Winner is not a participant in this room") {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    res.status(500).json({ error: "Could not choose winner" });
  }
});

router.post("/rooms/:id/questions/:questionId/rating", async (req: any, res) => {
  const params = z.object({ id: z.string().min(1), questionId: z.string().min(1) }).safeParse(req.params);
  const body = RateQuestionBody.safeParse(req.body);

  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, params.data.id) });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const question = await db.query.questionBankTable.findFirst({ where: eq(questionBankTable.id, params.data.questionId) });
  if (!question) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const auth = getAuth(req);
  const participantId = typeof req.body.participantId === "string" ? req.body.participantId : null;
  const user = auth?.userId
    ? await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, auth.userId) })
    : null;

  if (participantId) {
    const participant = await db.query.participantsTable.findFirst({
      where: and(eq(participantsTable.id, participantId), eq(participantsTable.roomId, room.id)),
    });
    if (!participant) {
      res.status(400).json({ error: "participantId does not belong to this room" });
      return;
    }
    if (user && participant.userId && participant.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  await recordQuestionRated({
    roomId: room.id,
    participantId,
    userId: user?.id ?? null,
    questionId: question.id,
    round: room.currentRound ?? 1,
    rating: body.data.rating,
    packSlug: question.packSlug,
    category: question.category,
    difficulty: question.difficulty,
  });

  res.status(201).json({ ok: true });
});

export default router;
