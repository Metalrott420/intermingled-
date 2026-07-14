import { Router, type IRouter } from "express";
import { eq, and, or, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getAuth } from "@clerk/express";
import { db, roomsTable, participantsTable, messagesTable, usersTable, matchesTable } from "@workspace/db";
import {
  CreateRoomBody,
  GetRoomParams,
  JoinRoomParams,
  JoinRoomBody,
  GetRoomMessagesParams,
  ChooseWinnerParams,
  ChooseWinnerBody,
} from "@workspace/api-zod";
import { getIo, isUserInPool } from "../socket";
import { rankSuitors } from "../lib/matchmaking";
import { checkPremiumEntitlement } from "./entitlement";

const router: IRouter = Router();

function makeCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function makeId(): string {
  return randomBytes(8).toString("hex");
}

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
};

async function buildRoomResponse(roomId: string) {
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });
  if (!room) return null;

  const participants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, roomId),
  });

  const suitorCount = participants.filter((p) => p.role === "suitor").length;

  return {
    id: room.id,
    code: room.code,
    status: room.status,
    chooserName: room.chooserName ?? null,
    suitorCount,
    maxSuitors: room.maxSuitors,
    currentRound: room.currentRound,
    eliminatedParticipants: (room.eliminatedParticipants ?? []) as string[],
    winnerId: room.winnerId ?? null,
    winnerName: room.winnerName ?? null,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      suitorSlot: p.suitorSlot ?? null,
      isBot: p.isBot,
    })),
    createdAt: room.createdAt.toISOString(),
  };
}

/**
 * Verifies that the caller is the chooser of the room by comparing their
 * stable DB user ID against rooms.chooser_user_id (set at match-creation time).
 * Returns { room, user } on success, null on failure.
 */
const BOT_NAMES = ["Alex", "Jordan", "Quinn", "Casey", "Morgan", "Riley", "Taylor", "Avery"];

async function fillBotsIfNeeded(roomId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return;

  const participants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, roomId),
  });
  const suitors = participants.filter((p) => p.role === "suitor");
  const filledSlots = suitors.map((p) => p.suitorSlot).filter((s): s is number => s !== null);
  const usedNames = suitors.map((p) => p.name);

  for (let slot = 1; slot <= room.maxSuitors; slot++) {
    if (!filledSlots.includes(slot)) {
      const available = BOT_NAMES.filter((n) => !usedNames.includes(n));
      const name = available[Math.floor(Math.random() * available.length)] ?? `Bot ${slot}`;
      usedNames.push(name);
      await db.insert(participantsTable).values({
        id: makeId(),
        roomId,
        userId: null,
        name,
        role: "suitor",
        suitorSlot: slot,
        isBot: true,
      });
    }
  }

  // If the room was waiting, start it now that all slots are filled
  if (room.status === "waiting") {
    await db.update(roomsTable).set({ status: "active" }).where(eq(roomsTable.id, roomId));
    const io = getIo();
    const updatedRoom = await buildRoomResponse(roomId);
    io.to(roomId).emit("room_updated", updatedRoom);
    io.to(roomId).emit("session_started", updatedRoom);
  }
}

async function verifyChooser(roomId: string, clerkUserId: string) {
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, clerkUserId),
  });
  if (!user) return null;

  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });
  if (!room) return null;

  // Primary: authorize by stable user ID stored at room creation
  if (room.chooserUserId && room.chooserUserId !== user.id) return null;
  // If chooserUserId not set (legacy manual rooms), fall through to deny
  if (!room.chooserUserId) return null;

  return { room, user };
}

router.post("/rooms", async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const id = makeId();
  const code = makeCode();

  await db.insert(roomsTable).values({
    id,
    code,
    chooserName: body.data.chooserName,
    status: "waiting",
    maxSuitors: 3,
  });

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId: id,
    name: body.data.chooserName,
    role: "chooser",
    suitorSlot: null,
  });

  await fillBotsIfNeeded(id);
  const roomData = await buildRoomResponse(id);
  res.status(201).json(roomData);
});

router.post("/rooms/match", requireAuth, async (req: any, res) => {
  const { chooserUserId } = req.body;
  if (typeof chooserUserId !== "string" || !chooserUserId) {
    res.status(400).json({ error: "chooserUserId is required" });
    return;
  }

  // Verify the authenticated caller IS the chooser they claim to be
  const callerUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.clerkId, req.clerkUserId),
  });
  if (!callerUser || callerUser.id !== chooserUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const chooser = await db.query.usersTable.findFirst({
    where: and(eq(usersTable.id, chooserUserId), eq(usersTable.role, "chooser")),
  });
  if (!chooser) {
    res.status(404).json({ error: "Chooser user not found" });
    return;
  }

  // Find only users who are:
  //   1. role = suitor (never choosers)
  //   2. status = looking (not already matched/in_room)
  //   3. Actively connected to the socket pool (live presence)
  const dbCandidates = await db.query.usersTable.findMany({
    where: and(eq(usersTable.status, "looking"), eq(usersTable.role, "suitor")),
  });
  const liveSuitorPool = dbCandidates.filter((u) => isUserInPool(u.id));

  if (!chooser.personalityVector) {
    res.status(400).json({ error: "Chooser has no personality vector" });
    return;
  }

  const suitorsWithVector = liveSuitorPool.filter(
    (u): u is typeof u & { personalityVector: number[] } => u.personalityVector !== null,
  );
  // Check premium entitlement for each candidate suitor so premium users
  // receive priority pool placement (PREMIUM_POOL_BOOST in matchmaking score).
  // RevenueCat app_user_id is the Clerk user ID (s.clerkId), not the DB UUID.
  const premiumFlags = await Promise.all(
    suitorsWithVector.map((s) =>
      s.clerkId ? checkPremiumEntitlement(s.clerkId) : Promise.resolve(false),
    ),
  );
  const suitorsWithPremium = suitorsWithVector.map((s, i) => ({
    ...s,
    isPremium: premiumFlags[i],
  }));

  // Fill as many real suitors as available; bots fill remaining slots after room creation
  const realSuitorCount = Math.min(suitorsWithPremium.length, 3);
  const topSuitors = rankSuitors(chooser.personalityVector, suitorsWithPremium, realSuitorCount);

  // Create room, start it active immediately — store chooserUserId for authorization
  const roomId = makeId();
  const code = makeCode();
  await db.insert(roomsTable).values({
    id: roomId,
    code,
    chooserName: chooser.name,
    chooserUserId: chooser.id,
    status: "active",
    maxSuitors: 3,
  });

  // Add chooser as participant with their DB user ID
  const chooserParticipantId = makeId();
  await db.insert(participantsTable).values({
    id: chooserParticipantId,
    roomId,
    userId: chooser.id,
    name: chooser.name,
    role: "chooser",
    suitorSlot: null,
  });

  // Mark chooser as in_room
  await db.update(usersTable).set({ status: "in_room" }).where(eq(usersTable.id, chooserUserId));

  const io = getIo();

  // Add top 3 suitors, update their status, notify them via socket, and
  // emit a per-suitor slot_filled event to the chooser for real-time UI updates
  for (let i = 0; i < topSuitors.length; i++) {
    const suitor = topSuitors[i];
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId,
      userId: suitor.id,
      name: suitor.name,
      role: "suitor",
      suitorSlot: i + 1,
    });
    await db.update(usersTable).set({ status: "matched" }).where(eq(usersTable.id, suitor.id));

    // Notify suitor — they will auto-redirect to their room
    io.to(`user_${suitor.id}`).emit("match_found", { roomId, participantId });

    // Notify chooser of each slot being filled in sequence
    io.to(`user_${chooserUserId}`).emit("slot_filled", {
      slot: i + 1,
      suitorName: suitor.name,
      participantId,
      roomId,
    });
  }

  // Fill remaining suitor slots with AI bots
  await fillBotsIfNeeded(roomId);

  const roomData = await buildRoomResponse(roomId);
  res.status(201).json({ ...roomData, chooserParticipantId });
});

router.get("/rooms/active", async (_req, res) => {
  // Return rooms that are joinable: either still waiting, OR active but with
  // bot slots available for displacement (so real suitors can replace bots).
  const waitingRooms = await db.query.roomsTable.findMany({
    where: eq(roomsTable.status, "waiting"),
  });

  // Find active rooms that still have at least one bot suitor
  const botParticipants = await db.query.participantsTable.findMany({
    where: and(eq(participantsTable.role, "suitor"), eq(participantsTable.isBot, true)),
  });
  const activeRoomIdsWithBots = [...new Set(botParticipants.map((p) => p.roomId))];

  const activeRoomsWithBots =
    activeRoomIdsWithBots.length > 0
      ? await db.query.roomsTable.findMany({
          where: and(
            eq(roomsTable.status, "active"),
            inArray(roomsTable.id, activeRoomIdsWithBots),
          ),
        })
      : [];

  const allJoinable = [...waitingRooms, ...activeRoomsWithBots];
  const results = await Promise.all(allJoinable.map((r) => buildRoomResponse(r.id)));
  res.json(results.filter(Boolean));
});

router.get("/rooms/:id", async (req, res) => {
  const params = GetRoomParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room id" });
    return;
  }

  const roomData = await buildRoomResponse(params.data.id);
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

  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, params.data.id),
  });

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (room.status === "ended") {
    res.status(400).json({ error: "Room has ended" });
    return;
  }

  const existing = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, room.id),
  });

  if (body.data.role === "chooser") {
    const hasChooser = existing.some((p) => p.role === "chooser");
    if (hasChooser) {
      res.status(400).json({ error: "Room already has a chooser" });
      return;
    }
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId: room.id,
      name: body.data.name,
      role: "chooser",
      suitorSlot: null,
    });
    await db.update(roomsTable).set({ chooserName: body.data.name }).where(eq(roomsTable.id, room.id));

    const roomData = await buildRoomResponse(room.id);
    const io = getIo();
    io.to(room.id).emit("room_updated", roomData);

    res.json({ participantId, room: roomData });
    return;
  }

  // role === suitor
  const suitors = existing.filter((p) => p.role === "suitor");
  const realSuitors = suitors.filter((p) => !p.isBot);
  const botSuitors = suitors.filter((p) => p.isBot);

  // If room is already active with bots, allow displacement of a bot slot
  if (room.status === "active") {
    if (botSuitors.length === 0) {
      res.status(400).json({ error: "Room is full" });
      return;
    }
    // Replace the first available bot with the real suitor
    const bot = botSuitors[0]!;
    const slot = bot.suitorSlot!;
    await db.delete(participantsTable).where(eq(participantsTable.id, bot.id));
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId: room.id,
      name: body.data.name,
      role: "suitor",
      suitorSlot: slot,
      isBot: false,
    });
    const io = getIo();
    const roomData = await buildRoomResponse(room.id);
    io.to(room.id).emit("room_updated", roomData);
    res.json({ participantId, room: roomData });
    return;
  }

  // Waiting room: normal flow (fallback if bots weren't filled yet)
  if (realSuitors.length >= room.maxSuitors) {
    res.status(400).json({ error: "Room is full" });
    return;
  }

  const usedSlots = suitors.map((p) => p.suitorSlot).filter((s): s is number => s !== null);
  let slot = 1;
  while (usedSlots.includes(slot)) slot++;

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId: room.id,
    name: body.data.name,
    role: "suitor",
    suitorSlot: slot,
    isBot: false,
  });

  const io = getIo();
  const roomData = await buildRoomResponse(room.id);
  io.to(room.id).emit("room_updated", roomData);

  // Auto-start if all real suitor slots filled (bots handle remaining)
  if (slot === room.maxSuitors) {
    await db.update(roomsTable).set({ status: "active" }).where(eq(roomsTable.id, room.id));
    const updatedRoom = await buildRoomResponse(room.id);
    io.to(room.id).emit("room_updated", updatedRoom);
    io.to(room.id).emit("session_started", updatedRoom);
  }

  res.json({ participantId, room: roomData });
});

// GET /api/rooms/:id/messages — fetch room transcript
// Requires Clerk auth. The caller must have a participant record (with userId)
// in this room, so only real room members can read the transcript.
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

  // Verify caller has a participant record linked to their user ID in this room
  const participant = await db.query.participantsTable.findFirst({
    where: and(
      eq(participantsTable.roomId, params.data.id),
      eq(participantsTable.userId, user.id),
    ),
  });
  if (!participant) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const msgs = await db.query.messagesTable.findMany({
    where: eq(messagesTable.roomId, params.data.id),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  res.json(
    msgs.map((m) => ({
      id: m.id,
      roomId: m.roomId,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole,
      suitorSlot: m.suitorSlot ?? null,
      round: m.round ?? null,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

// POST /api/rooms/:id/eliminate — chooser eliminates one suitor (rounds 1-3)
// Requires Clerk auth; caller must be the chooser of this room.
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
  const { room } = verified;

  const alreadyEliminated = (room.eliminatedParticipants ?? []) as string[];
  if (alreadyEliminated.includes(participantId)) {
    res.status(400).json({ error: "Already eliminated" });
    return;
  }

  // Verify the target participant actually belongs to this room
  const target = await db.query.participantsTable.findFirst({
    where: and(
      eq(participantsTable.id, participantId),
      eq(participantsTable.roomId, room.id),
    ),
  });
  if (!target) {
    res.status(404).json({ error: "Participant not found in this room" });
    return;
  }

  const newEliminated = [...alreadyEliminated, participantId];
  await db.update(roomsTable).set({ eliminatedParticipants: newEliminated }).where(eq(roomsTable.id, room.id));

  const io = getIo();

  // Check if only AI bots remain after this elimination
  const allParticipants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, room.id),
  });
  const activeSuitors = allParticipants.filter(
    (p) => p.role === "suitor" && !newEliminated.includes(p.id),
  );
  const onlyBotsRemain = activeSuitors.length > 0 && activeSuitors.every((p) => p.isBot);

  if (onlyBotsRemain) {
    await db.update(roomsTable)
      .set({ status: "ended", winnerId: null, winnerName: null })
      .where(eq(roomsTable.id, room.id));
    const finalRoom = await buildRoomResponse(room.id);
    io.to(room.id).emit("room_updated", finalRoom);
    io.to(room.id).emit("suitor_eliminated", { participantId });
    io.to(room.id).emit("session_ended", { winnerName: null, winnerId: null, reason: "no_human_suitors" });
    res.json(finalRoom);
    return;
  }

  const roomData = await buildRoomResponse(room.id);
  io.to(room.id).emit("room_updated", roomData);
  io.to(room.id).emit("suitor_eliminated", { participantId });

  res.json(roomData);
});

// POST /api/rooms/:id/advance-round — move to the next round
// Requires Clerk auth; caller must be the chooser of this room.
router.post("/rooms/:id/advance-round", requireAuth, async (req: any, res) => {
  const verified = await verifyChooser(req.params.id, req.clerkUserId);
  if (!verified) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { room } = verified;

  const newRound = room.currentRound + 1;
  await db.update(roomsTable).set({ currentRound: newRound }).where(eq(roomsTable.id, room.id));

  const roomData = await buildRoomResponse(room.id);
  const io = getIo();
  io.to(room.id).emit("room_updated", roomData);
  io.to(room.id).emit("round_advanced", { round: newRound });

  res.json(roomData);
});

// POST /api/rooms/:id/choose — chooser picks the winner and ends the room
// Requires Clerk auth; caller must be the chooser of this room.
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
  const { room } = verified;

  // Verify the claimed winner actually belongs to this room
  const winner = await db.query.participantsTable.findFirst({
    where: and(
      eq(participantsTable.roomId, room.id),
      eq(participantsTable.id, body.data.winnerId),
    ),
  });
  if (!winner) {
    res.status(400).json({ error: "Winner is not a participant in this room" });
    return;
  }

  // Bots can never be chosen as winners — end the room without a match
  if (winner.isBot) {
    await db.update(roomsTable)
      .set({ status: "ended", winnerId: null, winnerName: null })
      .where(eq(roomsTable.id, room.id));
    const finalRoom = await buildRoomResponse(room.id);
    const io = getIo();
    io.to(room.id).emit("room_updated", finalRoom);
    io.to(room.id).emit("session_ended", { winnerName: null, winnerId: null, reason: "no_human_suitors" });
    res.json(finalRoom);
    return;
  }

  await db
    .update(roomsTable)
    .set({
      status: "ended",
      winnerId: body.data.winnerId,
      winnerName: winner.name,
    })
    .where(eq(roomsTable.id, room.id));

  // Create a 1-on-1 match record using the stable user IDs stored on participants.
  try {
    const chooserParticipant = await db.query.participantsTable.findFirst({
      where: and(
        eq(participantsTable.roomId, room.id),
        eq(participantsTable.role, "chooser"),
      ),
    });
    const winnerParticipant = winner ?? null;

    const chooserUserId = chooserParticipant?.userId ?? null;
    const suitorUserId = winnerParticipant?.userId ?? null;

    if (chooserUserId && suitorUserId) {
      const existingMatch = await db.query.matchesTable.findFirst({
        where: and(
          eq(matchesTable.chooserUserId, chooserUserId),
          eq(matchesTable.suitorUserId, suitorUserId),
        ),
      });
      if (!existingMatch) {
        await db.insert(matchesTable).values({
          id: makeId(),
          roomId: room.id,
          chooserUserId,
          suitorUserId,
          chooserName: chooserParticipant!.name,
          suitorName: winnerParticipant!.name,
        });
      }
    }
  } catch (matchErr) {
    // Non-fatal — room result is still valid
  }

  const roomData = await buildRoomResponse(room.id);
  const io = getIo();
  io.to(room.id).emit("room_updated", roomData);
  io.to(room.id).emit("session_ended", { winnerName: winner?.name ?? null, winnerId: body.data.winnerId });

  res.json(roomData);
});

export default router;
