import { eq } from "drizzle-orm";
import { db, gameArchivesTable, gameplayEventsTable, matchesTable, messagesTable, participantsTable, playerGameHistoryTable, playerGameStatsTable, roomsTable } from "@workspace/db";
import { makeId } from "./utils";
import { trackGameplayEvent } from "./analyticsService";
import { logDuplicateArchive } from "./gameplayAssertions";

type QuestionTelemetrySummary = {
  askedCount: number;
  completedCount: number;
  skippedCount: number;
  timeoutCount: number;
  ratedCount: number;
  averageResponseTimeSeconds: number | null;
  averageRating: number | null;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function summarizeQuestionTelemetry(events: Array<{ eventType: string; payload: Record<string, unknown> }>): QuestionTelemetrySummary {
  const responseTimes: number[] = [];
  const ratings: number[] = [];

  let askedCount = 0;
  let completedCount = 0;
  let skippedCount = 0;
  let timeoutCount = 0;

  for (const event of events) {
    if (event.eventType === "question_asked") {
      askedCount += 1;
      continue;
    }

    if (event.eventType === "question_completed") {
      completedCount += 1;
      const responseTimeSeconds = asNumber(event.payload.responseTimeSeconds);
      if (responseTimeSeconds !== null) {
        responseTimes.push(responseTimeSeconds);
      }
      continue;
    }

    if (event.eventType === "question_timeout") {
      timeoutCount += 1;
      continue;
    }

    if (event.eventType === "question_skipped") {
      skippedCount += 1;
      continue;
    }

    if (event.eventType === "question_rated") {
      const rating = asNumber(event.payload.rating);
      if (rating !== null) {
        ratings.push(rating);
      }
    }
  }

  const averageResponseTimeSeconds =
    responseTimes.length > 0
      ? Number((responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(2))
      : null;

  const averageRating =
    ratings.length > 0
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2))
      : null;

  return {
    askedCount,
    completedCount,
    skippedCount,
    timeoutCount,
    ratedCount: ratings.length,
    averageResponseTimeSeconds,
    averageRating,
  };
}

export async function archiveCompletedGame(roomId: string): Promise<void> {
  const existingArchive = await db.select().from(gameArchivesTable).where(eq(gameArchivesTable.roomId, roomId)).then((rows) => rows[0] ?? null);
  if (existingArchive) {
    logDuplicateArchive(roomId);
    return;
  }

  const room = await db.select().from(roomsTable).where(eq(roomsTable.id, roomId)).then((rows) => rows[0] ?? null);
  if (!room) return;

  const participants = await db.select().from(participantsTable).where(eq(participantsTable.roomId, roomId));
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.roomId, roomId));
  const match = await db.select().from(matchesTable).where(eq(matchesTable.roomId, roomId)).then((rows) => rows[0] ?? null);
  const events = await db.select().from(gameplayEventsTable).where(eq(gameplayEventsTable.roomId, roomId));
  const questionTelemetrySummary = summarizeQuestionTelemetry(events as Array<{ eventType: string; payload: Record<string, unknown> }>);
  const eliminationRounds = new Map<string, number>();
  for (const event of events) {
    if (event.eventType !== "suitor_eliminated") continue;
    const participantId = typeof event.payload.participantId === "string" ? event.payload.participantId : null;
    const round = typeof event.payload.round === "number" ? event.payload.round : null;
    if (participantId && round !== null) {
      eliminationRounds.set(participantId, round);
    }
  }

  const archivedAt = new Date();
  const queueTimeSeconds = Math.max(0, Math.round((archivedAt.getTime() - room.createdAt.getTime()) / 1000));
  const gameDurationSeconds = Math.max(0, Math.round((archivedAt.getTime() - room.createdAt.getTime()) / 1000));
  const finalParticipants = participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    role: participant.role,
    suitorSlot: participant.suitorSlot ?? null,
    isBot: participant.isBot,
    isPremium: participant.isPremium,
  }));
  const questionsAsked = messages
    .filter((message) => message.senderRole === "chooser")
    .map((message) => ({
      participantId: message.senderId,
      suitorSlot: message.suitorSlot ?? null,
      round: message.round ?? null,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));
  const roundDurations = Array.from({ length: room.numberOfRounds ?? 3 }, () => room.roundDurationSeconds ?? 30);

  await db.insert(gameArchivesTable).values({
    id: makeId(),
    roomId,
    finalParticipants,
    eliminationOrder: room.eliminatedParticipants ?? [],
    questionsAsked,
    roundDurations,
    winnerId: room.winnerId,
    winnerName: room.winnerName,
    matchStatus: match ? "matched" : "unmatched",
    analyticsMetadata: {
      roomCode: room.code,
      maxSuitors: room.maxSuitors,
      numberOfRounds: room.numberOfRounds,
      roundDurationSeconds: room.roundDurationSeconds,
      answerTimeSeconds: room.answerTimeSeconds,
      completionTimestamp: archivedAt.toISOString(),
      queueTimeSeconds,
      gameDurationSeconds,
      messageCount: messages.length,
      participantCount: participants.length,
      eventCount: events.length,
      eliminationEventCount: events.filter((event: { eventType: string }) => event.eventType === "suitor_eliminated").length,
      averageResponseTimeSeconds: questionTelemetrySummary.averageResponseTimeSeconds,
      questionTelemetrySummary,
    },
  });

  for (const participant of participants) {
    if (!participant.userId) continue;
    const existingStats = await db.select().from(playerGameStatsTable).where(eq(playerGameStatsTable.userId, participant.userId)).then((rows) => rows[0] ?? null);
    const eliminatedAtRound = eliminationRounds.get(participant.id) ?? null;
    const roundsSurvived = participant.id === room.winnerId
      ? (room.numberOfRounds ?? 3)
      : eliminatedAtRound !== null
        ? Math.max(0, eliminatedAtRound - 1)
        : Math.max(0, (room.currentRound ?? 1) - 1);

    if (existingStats) {
      await db
        .update(playerGameStatsTable)
        .set({
          gamesPlayed: existingStats.gamesPlayed + 1,
          wins: existingStats.wins + (participant.id === room.winnerId ? 1 : 0),
          matches: existingStats.matches + (match ? 1 : 0),
          totalRoundsSurvived: existingStats.totalRoundsSurvived + roundsSurvived,
          lastPlayedAt: archivedAt,
          updatedAt: archivedAt,
        })
        .where(eq(playerGameStatsTable.id, existingStats.id));
    } else {
      await db.insert(playerGameStatsTable).values({
        id: makeId(),
        userId: participant.userId,
        gamesPlayed: 1,
        wins: participant.id === room.winnerId ? 1 : 0,
        matches: match ? 1 : 0,
        totalRoundsSurvived: roundsSurvived,
        lastPlayedAt: archivedAt,
      });
    }

    await db.insert(playerGameHistoryTable).values({
      id: makeId(),
      userId: participant.userId,
      roomId,
      participantId: participant.id,
      role: participant.role,
      isWinner: participant.id === room.winnerId,
      matchStatus: match ? "matched" : "unmatched",
      roundsSurvived,
      eliminatedAtRound,
    });
  }

  await trackGameplayEvent("game_archived", {
    roomId,
    winnerId: room.winnerId,
    matchStatus: match ? "matched" : "unmatched",
    archivedAt: archivedAt.toISOString(),
  }, { roomId });
}
