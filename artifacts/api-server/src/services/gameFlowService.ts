import { db, roomsTable, participantsTable, matchesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { buildRoomResponse } from "../lib/roomUtils";
import {
  emitRoomUpdated,
  emitSuitorEliminated,
  emitRoundAdvanced,
  emitSessionEnded,
  emitRoundStarted,
  emitTimerSync,
} from "./messagingService";
import { DEFAULT_ROUND_DURATION_SECONDS } from "./gameConstants";
import { GameState, getGameState } from "./gameState";
import { logger } from "../lib/logger";
import { makeId } from "./utils";
import { archiveCompletedGame } from "./gameArchivalService";
import { trackGameplayEvent } from "./analyticsService";
import { assertRoomTransition, assertWinnerImmutable, logDuplicateMatch } from "./gameplayAssertions";
import { selectRoundQuestionsForRoom, type RoomQuestionConfig } from "./questionService";
import { finalizeOutstandingQuestions, finalizeRoomQuestionExposures, getSuitorSlotForParticipant } from "./questionTelemetryService";

async function loadRoomResponseOrFail(roomId: string) {
  const roomData = await buildRoomResponse(roomId);
  if (!roomData) throw new Error("Room not found");
  return roomData;
}

/**
 * GameFlowService owns the core game lifecycle transitions for a session.
 *
 * It should never own raw socket authentication, profile management, or
 * question generation. Those responsibilities belong to other dedicated services.
 */

/**
 * Starts a game session by moving it from waiting into active.
 *
 * @param roomId - session id to start
 * @returns the updated session payload
 */
export async function startGame(roomId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");

  const endsAt = new Date(Date.now() + (room.roundDurationSeconds ?? DEFAULT_ROUND_DURATION_SECONDS) * 1000);
  await db.update(roomsTable).set({ status: "active", roundEndsAt: endsAt, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, roomId));
  const roomData = await loadRoomResponseOrFail(roomId);
  assertRoomTransition(room as any, roomData as any, "startGame");
  await emitRoomUpdated(roomId, roomData);
  await emitRoundStarted(roomId, roomData.currentRound, roomData.roundEndsAt ? new Date(roomData.roundEndsAt) : null);
  await emitTimerSync(roomId, roomData.roundEndsAt ? new Date(roomData.roundEndsAt) : null);
  await trackGameplayEvent("game_started", {
    currentRound: roomData.currentRound,
    roundEndsAt: roomData.roundEndsAt,
  }, { roomId });
  return roomData;
}

/**
 * Advances the current round number for a live game session.
 *
 * @param roomId - session id to advance
 * @returns the updated session payload
 */
function getFinalRound(room: { maxSuitors: number }) {
  return room.maxSuitors - 1;
}

export async function advanceRound(roomId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");

  const finalRound = getFinalRound(room);
  if (room.currentRound >= finalRound) {
    throw new Error("Cannot advance beyond final round");
  }

  await finalizeRoomQuestionExposures({
    roomId,
    round: room.currentRound,
    questionIds: (room.currentRoundQuestionIds ?? []) as string[],
    reason: "timeout",
  });

  await finalizeOutstandingQuestions({
    roomId,
    round: room.currentRound,
    reason: "timeout",
  });

  const newRound = room.currentRound + 1;
  const endsAt = new Date(Date.now() + (room.roundDurationSeconds ?? DEFAULT_ROUND_DURATION_SECONDS) * 1000);

  const selected = await selectRoundQuestionsForRoom({
    roomId,
    round: newRound,
    maxSuitors: room.maxSuitors,
    previouslyUsedQuestionIds: (room.usedQuestionIds ?? []) as string[],
    config: (room.questionConfig ?? {}) as RoomQuestionConfig,
  });
  const selectedIds = selected.questions.map((question) => question.id).filter((id): id is string => Boolean(id));
  const nextUsedIds = [...new Set([...(room.usedQuestionIds ?? []) as string[], ...selectedIds])];

  await db.update(roomsTable).set({
    currentRound: newRound,
    roundEndsAt: endsAt,
    currentRoundQuestionIds: selectedIds,
    usedQuestionIds: nextUsedIds,
    roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1`,
  }).where(eq(roomsTable.id, roomId));
  const roomData = await loadRoomResponseOrFail(roomId);
  assertRoomTransition(room as any, roomData as any, "advanceRound");
  await emitRoomUpdated(roomId, roomData);
  await emitRoundAdvanced(roomId, newRound, roomData.roomSnapshotVersion);
  await emitRoundStarted(roomId, newRound, roomData.roundEndsAt ? new Date(roomData.roundEndsAt) : null);
  await emitTimerSync(roomId, roomData.roundEndsAt ? new Date(roomData.roundEndsAt) : null);
  await trackGameplayEvent("round_advanced", { round: newRound, endsAt: roomData.roundEndsAt }, { roomId });
  return roomData;
}

/**
 * Eliminates a suitor from the live game session and emits the result.
 *
 * @param roomId - session id where elimination occurs
 * @param participantId - participant id being eliminated
 * @returns the updated session payload after elimination
 */
export async function eliminateSuitor(roomId: string, participantId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");

  const finalRound = getFinalRound(room);
  if (room.currentRound >= finalRound) {
    throw new Error("Cannot eliminate in the final round");
  }

  await finalizeRoomQuestionExposures({
    roomId,
    round: room.currentRound,
    questionIds: (room.currentRoundQuestionIds ?? []) as string[],
    reason: "skipped",
  });

  const alreadyEliminated = (room.eliminatedParticipants ?? []) as string[];
  if (alreadyEliminated.includes(participantId)) throw new Error("Already eliminated");

  const target = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.id, participantId), eq(participantsTable.roomId, room.id)),
  });
  if (!target || target.role !== "suitor") throw new Error("Participant not found in this room");

  const suitorSlot = await getSuitorSlotForParticipant(roomId, participantId);
  if (suitorSlot !== null) {
    await finalizeOutstandingQuestions({
      roomId,
      round: room.currentRound,
      reason: "skipped",
      suitorSlot,
    });
  }

  const newEliminated = [...alreadyEliminated, participantId];
  await db.update(roomsTable).set({ eliminatedParticipants: newEliminated, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));

  const allParticipants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, room.id),
  });
  const activeSuitors = allParticipants.filter((p) => p.role === "suitor" && !newEliminated.includes(p.id));
  const onlyBotsRemain = activeSuitors.length > 0 && activeSuitors.every((p) => p.isBot);

  await trackGameplayEvent("suitor_eliminated", { participantId, round: room.currentRound }, { roomId, participantId });

  if (onlyBotsRemain) {
    await db.update(roomsTable).set({ status: "ended", winnerId: null, winnerName: null, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));
    const finalRoom = await loadRoomResponseOrFail(room.id);
    assertRoomTransition(room as any, finalRoom as any, "eliminateSuitor.onlyBotsRemain");
    await emitRoomUpdated(room.id, finalRoom);
    await emitSuitorEliminated(room.id, participantId, finalRoom.roomSnapshotVersion);
    await emitSessionEnded(room.id, { winnerName: null, winnerId: null, reason: "no_human_suitors", roomSnapshotVersion: finalRoom.roomSnapshotVersion });
    await archiveCompletedGame(room.id);
    return finalRoom;
  }

  const roomData = await loadRoomResponseOrFail(room.id);
  assertRoomTransition(room as any, roomData as any, "eliminateSuitor");
  await emitRoomUpdated(room.id, roomData);
  await emitSuitorEliminated(room.id, participantId, roomData.roomSnapshotVersion);
  await trackGameplayEvent("suitor_eliminated_broadcast", { participantId, round: room.currentRound }, { roomId, participantId });
  return roomData;
}

/**
 * Completes the game by selecting a winner and creating a match record.
 *
 * @param roomId - session id in which the winner is chosen
 * @param winnerId - participant id selected as winner
 * @returns the final session payload
 */
export async function chooseWinner(roomId: string, winnerId: string) {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  if (!room) throw new Error("Room not found");
  assertWinnerImmutable(room as any, winnerId, "chooseWinner");

  const finalRound = getFinalRound(room);
  if (room.currentRound < finalRound) {
    throw new Error("Cannot choose a winner before the final round");
  }

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

  const winner = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.roomId, room.id), eq(participantsTable.id, winnerId)),
  });
  if (!winner) throw new Error("Winner is not a participant in this room");

  if (winner.isBot) {
    await db.update(roomsTable).set({ status: "ended", winnerId: null, winnerName: null, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));
    const finalRoom = await loadRoomResponseOrFail(room.id);
    await emitRoomUpdated(room.id, finalRoom);
    await emitSessionEnded(room.id, { winnerName: null, winnerId: null, reason: "no_human_suitors", roomSnapshotVersion: finalRoom.roomSnapshotVersion });
    await archiveCompletedGame(room.id);
    return finalRoom;
  }

  await db.update(roomsTable).set({ status: "ended", winnerId: winner.id, winnerName: winner.name, roomSnapshotVersion: sql`${roomsTable.roomSnapshotVersion} + 1` }).where(eq(roomsTable.id, room.id));

  const chooserParticipant = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.roomId, room.id), eq(participantsTable.role, "chooser")),
  });

  const chooserUserId = chooserParticipant?.userId ?? null;
  const suitorUserId = winner.userId ?? null;

  if (chooserUserId && suitorUserId) {
    const existingMatch = await db.query.matchesTable.findFirst({
      where: and(eq(matchesTable.chooserUserId, chooserUserId), eq(matchesTable.suitorUserId, suitorUserId)),
    });
    if (!existingMatch) {
      await db.insert(matchesTable).values({
        id: makeId(),
        roomId: room.id,
        chooserUserId,
        suitorUserId,
        chooserName: chooserParticipant!.name,
        suitorName: winner.name,
      });
    } else {
      logDuplicateMatch(room.id, chooserUserId, suitorUserId);
    }
  }

  await trackGameplayEvent("match_created", {
    chooserUserId,
    suitorUserId,
    winnerId: winner.id,
  }, { roomId, userId: chooserUserId, participantId: winner.id });

  const roomData = await loadRoomResponseOrFail(room.id);
  assertRoomTransition(room as any, roomData as any, "chooseWinner");
  await emitRoomUpdated(room.id, roomData);
  await emitSessionEnded(room.id, { winnerName: winner.name, winnerId: winner.id, roomSnapshotVersion: roomData.roomSnapshotVersion });
  await archiveCompletedGame(room.id);
  return roomData;
}

/**
 * Derives the GameState enum for a room record.
 *
 * @param room - object containing persisted status and currentRound
 */
export function getGameStateForRoom(room: { status: string; currentRound: number }): GameState {
  return getGameState(room.status, room.currentRound);
}
