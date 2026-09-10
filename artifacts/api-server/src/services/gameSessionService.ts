/**
 * GameSessionService owns creation, joining, recovery, and graceful closure of
 * game sessions backed by the existing rooms table.
 *
 * It must never own the decision logic for eliminations, winner selection, or
 * round progression. Those responsibilities belong to GameFlowService.
 */
import { db, roomsTable, participantsTable, usersTable, User, Room } from "@workspace/db";
import { randomBytes } from "crypto";
import { eq, and, inArray, sql } from "drizzle-orm";
import { buildRoomResponse } from "../lib/roomUtils";
import {
  MAX_SUITORS,
  MIN_SUITORS,
  MAX_ALLOWED_SUITORS,
  DEFAULT_NUMBER_OF_ROUNDS,
  DEFAULT_ROUND_DURATION_SECONDS,
  ANSWER_TIME_SECONDS,
  ALLOWED_ROUND_COUNTS,
} from "./gameConstants";
import { emitRoomUpdated, emitSessionEnded, emitSessionStarted, emitRoundStarted, emitTimerSync } from "./messagingService";
import { getCachedPremiumByClerkId } from "./subscriptionService";
import { getCachedPremiumForJoiningUser } from "./matchmakingService";
import { RoomUpdatedPayload } from "../socket/events";
import { assertRoomTransition } from "./gameplayAssertions";
import { selectRoundQuestionsForRoom, type RoomQuestionConfig } from "./questionService";
import { finalizeOutstandingQuestions, finalizeRoomQuestionExposures, recordQuestionExposed } from "./questionTelemetryService";

const BOT_NAMES = ["Alex", "Jordan", "Quinn", "Casey", "Morgan", "Riley", "Taylor", "Avery"];

async function loadRoomResponseOrFail(roomId: string) {
  const roomData = await buildRoomResponse(roomId);
  if (!roomData) throw new Error("Room not found");
  return roomData;
}

export type GameSessionPayload = Awaited<ReturnType<typeof buildRoomResponse>>;

function makeId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Creates a new game session and the initial chooser participant.
 *
 * @param chooserName - display name for the chooser in the session
 * @returns an object containing the created session payload and chooser participant id
 */
export async function createGameSession(
  chooserName: string,
  maxSuitors: number | null = null,
  numberOfRounds: number | null = null,
  questionConfig: RoomQuestionConfig = {},
) {
  const normalizedSuitors = maxSuitors ?? MAX_SUITORS;
  if (normalizedSuitors < MIN_SUITORS || normalizedSuitors > MAX_ALLOWED_SUITORS) {
    throw new Error("Invalid maxSuitors");
  }
  const normalizedRounds = numberOfRounds ?? DEFAULT_NUMBER_OF_ROUNDS;
  if (!ALLOWED_ROUND_COUNTS.includes(normalizedRounds as any)) {
    throw new Error("Invalid numberOfRounds");
  }

  const id = makeId();
  const code = randomBytes(3).toString("hex").toUpperCase();

  await db.insert(roomsTable).values({
    id,
    code,
    chooserName,
    status: "waiting",
    maxSuitors: normalizedSuitors,
    numberOfRounds: normalizedRounds,
    roundDurationSeconds: DEFAULT_ROUND_DURATION_SECONDS,
    answerTimeSeconds: ANSWER_TIME_SECONDS,
    questionConfig,
  });

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId: id,
    name: chooserName,
    role: "chooser",
    suitorSlot: null,
  });

  await fillBotsIfNeeded(id);
  const roomData = await loadRoomResponseOrFail(id);
  return { roomData, participantId };
}

async function seedRoundQuestions(roomId: string, room: { currentRound: number; maxSuitors: number; usedQuestionIds: string[]; questionConfig: Record<string, unknown> }) {
  const selected = await selectRoundQuestionsForRoom({
    roomId,
    round: room.currentRound,
    maxSuitors: room.maxSuitors,
    previouslyUsedQuestionIds: room.usedQuestionIds,
    config: (room.questionConfig as RoomQuestionConfig | undefined) ?? {},
  });

  const selectedIds = selected.questions.map((question) => question.id).filter((id): id is string => Boolean(id));
  if (selectedIds.length === 0) return;

  const mergedUsed = [...new Set([...(room.usedQuestionIds ?? []), ...selectedIds])];
  await db.update(roomsTable).set({
    currentRoundQuestionIds: selectedIds,
    usedQuestionIds: mergedUsed,
  }).where(eq(roomsTable.id, roomId));

  await Promise.all(
    selected.questions
      .filter((question) => typeof question.id === "string" && question.id.length > 0)
      .map((question) =>
        recordQuestionExposed({
          roomId,
          questionId: question.id!,
          round: room.currentRound,
          packSlug: question.packSlug ?? "core",
          category: question.category,
          difficulty: question.difficulty,
        }),
      ),
  );
}

/**
 * Ensures empty suitor slots are filled with AI bots and starts waiting rooms.
 */
export async function fillBotsIfNeeded(roomId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) return;

  const participants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, roomId),
  });
  const suitors = participants.filter((p) => p.role === "suitor");
  const filledSlots = suitors.map((p) => p.suitorSlot).filter((s): s is number => s !== null);
  const usedNames = suitors.map((p) => p.name);

  for (let slot = 1; slot <= room.maxSuitors; slot += 1) {
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

  if (room.status === "waiting") {
    const endsAt = new Date(Date.now() + (room.roundDurationSeconds ?? DEFAULT_ROUND_DURATION_SECONDS) * 1000);
    await db.update(roomsTable).set({ status: "active", roundEndsAt: endsAt, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, roomId));
    await seedRoundQuestions(roomId, {
      currentRound: room.currentRound,
      maxSuitors: room.maxSuitors,
      usedQuestionIds: (room.usedQuestionIds ?? []) as string[],
      questionConfig: (room.questionConfig ?? {}) as Record<string, unknown>,
    });
    const updatedRoom = await loadRoomResponseOrFail(roomId);
    assertRoomTransition(room as any, updatedRoom as any, "fillBotsIfNeeded.startRoom");
    await emitRoomUpdated(roomId, updatedRoom);
    await emitSessionStarted(roomId, updatedRoom);
    await emitRoundStarted(roomId, updatedRoom.currentRound, updatedRoom.roundEndsAt ? new Date(updatedRoom.roundEndsAt) : null);
    await emitTimerSync(roomId, updatedRoom.roundEndsAt ? new Date(updatedRoom.roundEndsAt) : null);
  }
}

type RoomResponsePayload = NonNullable<Awaited<ReturnType<typeof buildRoomResponse>>>;

export async function getJoinableRooms() {
  const waitingRooms = await db.query.roomsTable.findMany({
    where: eq(roomsTable.status, "waiting"),
  });

  const botParticipants = await db.query.participantsTable.findMany({
    where: and(eq(participantsTable.role, "suitor"), eq(participantsTable.isBot, true)),
    columns: { roomId: true },
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
  return results.filter((r): r is RoomResponsePayload => r !== null);
}

export async function getRoomById(roomId: string) {
  return buildRoomResponse(roomId);
}

export async function verifyChooser(roomId: string, clerkUserId: string) {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkUserId) });
  if (!user) return null;

  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room || !room.chooserUserId || room.chooserUserId !== user.id) return null;

  return { room, user };
}

/**
 * Adds a chooser or suitor to an existing game session.
 *
 * @param roomId - session id to join
 * @param role - desired role in the game session
 * @param name - participant display name
 * @param joiningClerkId - optional Clerk user id for premium flag lookup
 */
export async function joinGameSession(
  roomId: string,
  role: "chooser" | "suitor",
  name: string,
  joiningClerkId: string | null,
) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");
  if (room.status === "ended") throw new Error("Room has ended");

  const existing = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, room.id),
  });

  if (role === "chooser") {
    const hasChooser = existing.some((p) => p.role === "chooser");
    if (hasChooser) throw new Error("Room already has a chooser");

    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId: room.id,
      name,
      role: "chooser",
      suitorSlot: null,
    });
    await db.update(roomsTable).set({ chooserName: name, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));

    const roomData = await loadRoomResponseOrFail(room.id);
    assertRoomTransition(room as any, roomData as any, "joinGameSession.chooser");
    await emitRoomUpdated(room.id, roomData);
    return { participantId, roomData };
  }

  const joiningIsPremium = await getCachedPremiumForJoiningUser(joiningClerkId);
  const suitors = existing.filter((p) => p.role === "suitor");
  const realSuitors = suitors.filter((p) => !p.isBot);
  const botSuitors = suitors.filter((p) => p.isBot);

  if (room.status === "active") {
    if (botSuitors.length === 0) throw new Error("Room is full");
    const bot = botSuitors[0]!;
    const slot = bot.suitorSlot!;
    await db.delete(participantsTable).where(eq(participantsTable.id, bot.id));
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId: room.id,
      name,
      role: "suitor",
      suitorSlot: slot,
      isBot: false,
      isPremium: joiningIsPremium,
    });
    const roomData = await loadRoomResponseOrFail(room.id);
    await emitRoomUpdated(room.id, roomData);
    return { participantId, roomData };
  }

  if (realSuitors.length >= room.maxSuitors) throw new Error("Room is full");

  const usedSlots = suitors.map((p) => p.suitorSlot).filter((s): s is number => s != null);
  let slot = 1;
  while (usedSlots.includes(slot)) slot += 1;

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId: room.id,
    name,
    role: "suitor",
    suitorSlot: slot,
    isBot: false,
    isPremium: joiningIsPremium,
  });

  const roomData = await loadRoomResponseOrFail(room.id);
  await emitRoomUpdated(room.id, roomData);

  if (slot === room.maxSuitors) {
    await db.update(roomsTable).set({ status: "active", roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));
    await seedRoundQuestions(room.id, {
      currentRound: room.currentRound,
      maxSuitors: room.maxSuitors,
      usedQuestionIds: (room.usedQuestionIds ?? []) as string[],
      questionConfig: (room.questionConfig ?? {}) as Record<string, unknown>,
    });
    const updatedRoom = await loadRoomResponseOrFail(room.id);
    assertRoomTransition(room as any, updatedRoom as any, "joinGameSession.startOnFull");
    await emitRoomUpdated(room.id, updatedRoom);
    await emitSessionStarted(room.id, updatedRoom);
  }

  return { participantId, roomData };
}

/**
 * Recovers the current game session payload from persistence.
 *
 * @param roomId - session id to recover
 */
export async function recoverGameSession(roomId: string) {
  return loadRoomResponseOrFail(roomId);
}

/**
 * Closes a game session and emits a final update to connected clients.
 *
 * @param roomId - session id to close
 */
export async function closeGameSession(roomId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");
  await finalizeRoomQuestionExposures({
    roomId,
    round: room.currentRound,
    questionIds: (room.currentRoundQuestionIds ?? []) as string[],
    reason: "skipped",
  });
  await finalizeOutstandingQuestions({
    roomId,
    round: room.currentRound,
    reason: "skipped",
  });
  await db.update(roomsTable).set({ status: "ended", roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, roomId));
  const roomData = await loadRoomResponseOrFail(roomId);
  assertRoomTransition(room as any, roomData as any, "closeGameSession");
  await emitRoomUpdated(roomId, roomData);
  await emitSessionEnded(roomId, { winnerId: null, winnerName: null, reason: "closed", roomSnapshotVersion: roomData.roomSnapshotVersion });
  return roomData;
}
