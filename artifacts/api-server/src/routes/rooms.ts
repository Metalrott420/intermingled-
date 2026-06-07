import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
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

const router: IRouter = Router();

function makeCode(): string {
  return randomBytes(3).toString("hex").toUpperCase();
}

function makeId(): string {
  return randomBytes(8).toString("hex");
}

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
    })),
    createdAt: room.createdAt.toISOString(),
  };
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
    maxSuitors: 5,
  });

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId: id,
    name: body.data.chooserName,
    role: "chooser",
    suitorSlot: null,
  });

  const roomData = await buildRoomResponse(id);
  res.status(201).json(roomData);
});

router.post("/rooms/match", async (req, res) => {
  const { chooserUserId } = req.body;
  if (typeof chooserUserId !== "string" || !chooserUserId) {
    res.status(400).json({ error: "chooserUserId is required" });
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

  if (liveSuitorPool.length < 5) {
    res.status(409).json({
      error: "Not enough suitors in pool",
      count: liveSuitorPool.length,
    });
    return;
  }

  if (!chooser.personalityVector) {
    res.status(400).json({ error: "Chooser has no personality vector" });
    return;
  }

  const suitorsWithVector = liveSuitorPool.filter(
    (u): u is typeof u & { personalityVector: number[] } => u.personalityVector !== null,
  );
  const top5 = rankSuitors(chooser.personalityVector, suitorsWithVector, 5);

  // Create room, start it active immediately
  const roomId = makeId();
  const code = makeCode();
  await db.insert(roomsTable).values({
    id: roomId,
    code,
    chooserName: chooser.name,
    status: "active",
    maxSuitors: 5,
  });

  // Add chooser as participant
  const chooserParticipantId = makeId();
  await db.insert(participantsTable).values({
    id: chooserParticipantId,
    roomId,
    name: chooser.name,
    role: "chooser",
    suitorSlot: null,
  });

  // Mark chooser as in_room
  await db.update(usersTable).set({ status: "in_room" }).where(eq(usersTable.id, chooserUserId));

  const io = getIo();

  // Add top 5 suitors, update their status, notify them via socket, and
  // emit a per-suitor slot_filled event to the chooser for real-time UI updates
  for (let i = 0; i < top5.length; i++) {
    const suitor = top5[i];
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId,
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

  const roomData = await buildRoomResponse(roomId);
  res.status(201).json({ ...roomData, chooserParticipantId });
});

router.get("/rooms/active", async (_req, res) => {
  const rooms = await db.query.roomsTable.findMany({
    where: eq(roomsTable.status, "waiting"),
  });

  const results = await Promise.all(rooms.map((r) => buildRoomResponse(r.id)));
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
  if (suitors.length >= room.maxSuitors) {
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
  });

  const roomData = await buildRoomResponse(room.id);
  const io = getIo();
  io.to(room.id).emit("room_updated", roomData);

  // Auto-start if all slots filled
  if (slot === room.maxSuitors) {
    await db.update(roomsTable).set({ status: "active" }).where(eq(roomsTable.id, room.id));
    const updatedRoom = await buildRoomResponse(room.id);
    io.to(room.id).emit("room_updated", updatedRoom);
    io.to(room.id).emit("session_started", updatedRoom);
  }

  res.json({ participantId, room: roomData });
});

router.get("/rooms/:id/messages", async (req, res) => {
  const params = GetRoomMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid room id" });
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
router.post("/rooms/:id/eliminate", async (req, res) => {
  const { participantId } = req.body;
  if (typeof participantId !== "string" || !participantId) {
    res.status(400).json({ error: "participantId is required" });
    return;
  }

  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, req.params.id),
  });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const alreadyEliminated = (room.eliminatedParticipants ?? []) as string[];
  if (alreadyEliminated.includes(participantId)) {
    res.status(400).json({ error: "Already eliminated" });
    return;
  }

  const newEliminated = [...alreadyEliminated, participantId];
  await db.update(roomsTable).set({ eliminatedParticipants: newEliminated }).where(eq(roomsTable.id, room.id));

  const roomData = await buildRoomResponse(room.id);
  const io = getIo();
  io.to(room.id).emit("room_updated", roomData);
  io.to(room.id).emit("suitor_eliminated", { participantId });

  res.json(roomData);
});

// POST /api/rooms/:id/advance-round — move to the next round
router.post("/rooms/:id/advance-round", async (req, res) => {
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, req.params.id),
  });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const newRound = room.currentRound + 1;
  await db.update(roomsTable).set({ currentRound: newRound }).where(eq(roomsTable.id, room.id));

  const roomData = await buildRoomResponse(room.id);
  const io = getIo();
  io.to(room.id).emit("room_updated", roomData);
  io.to(room.id).emit("round_advanced", { round: newRound });

  res.json(roomData);
});

router.post("/rooms/:id/choose", async (req, res) => {
  const params = ChooseWinnerParams.safeParse(req.params);
  const body = ChooseWinnerBody.safeParse(req.body);

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

  const winner = await db.query.participantsTable.findFirst({
    where: and(
      eq(participantsTable.roomId, room.id),
      eq(participantsTable.id, body.data.winnerId),
    ),
  });

  await db
    .update(roomsTable)
    .set({
      status: "ended",
      winnerId: body.data.winnerId,
      winnerName: winner?.name ?? null,
    })
    .where(eq(roomsTable.id, room.id));

  // Create a 1-on-1 match record so both users get a private DM channel.
  // Look up both users by name so we can record their actual user IDs.
  try {
    const chooserUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.name, room.chooserName ?? ""),
    });
    const suitorUser = winner
      ? await db.query.usersTable.findFirst({
          where: eq(usersTable.name, winner.name),
        })
      : null;

    if (chooserUser && suitorUser) {
      const existingMatch = await db.query.matchesTable.findFirst({
        where: and(
          eq(matchesTable.chooserUserId, chooserUser.id),
          eq(matchesTable.suitorUserId, suitorUser.id),
        ),
      });
      if (!existingMatch) {
        await db.insert(matchesTable).values({
          id: makeId(),
          roomId: room.id,
          chooserUserId: chooserUser.id,
          suitorUserId: suitorUser.id,
          chooserName: chooserUser.name,
          suitorName: suitorUser.name,
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
