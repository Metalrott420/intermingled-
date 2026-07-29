import { eq } from "drizzle-orm";
import { db, roomsTable, participantsTable, questionBankTable } from "@workspace/db";
import { getQuestionRatingSnapshots } from "../services/questionTelemetryService";

export async function buildRoomResponse(roomId: string) {
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });
  if (!room) return null;

  const participants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, roomId),
  });

  const suitorCount = participants.filter((p) => p.role === "suitor").length;
  const currentRoundQuestionIds = (room.currentRoundQuestionIds ?? []) as string[];
  const ratingSnapshots = await getQuestionRatingSnapshots(currentRoundQuestionIds);
  const currentRoundQuestions = currentRoundQuestionIds.length > 0
    ? await Promise.all(
      currentRoundQuestionIds.map((id) =>
        db.query.questionBankTable.findFirst({ where: eq(questionBankTable.id, id) }),
      ),
    )
    : [];

  return {
    id: room.id,
    code: room.code,
    status: room.status,
    roomSnapshotVersion: room.roomSnapshotVersion,
    chooserName: room.chooserName ?? null,
    suitorCount,
    maxSuitors: room.maxSuitors,
    numberOfRounds: room.numberOfRounds ?? 3,
    roundDurationSeconds: room.roundDurationSeconds ?? 30,
    answerTimeSeconds: room.answerTimeSeconds ?? 15,
    questionConfig: (room.questionConfig ?? {}) as Record<string, unknown>,
    currentRoundQuestions: currentRoundQuestions
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((row) => ({
        id: row.id,
        content: row.content,
        packSlug: row.packSlug,
        category: row.category,
        difficulty: row.difficulty,
        ratingSummary: ratingSnapshots.get(row.id) ?? {
          questionId: row.id,
          ratingCount: 0,
          averageRating: null,
          qualityScore: null,
        },
      })),
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
      isPremium: p.isPremium,
    })),
    roundEndsAt: room.roundEndsAt ? room.roundEndsAt.toISOString() : null,
    createdAt: room.createdAt.toISOString(),
  };
}
