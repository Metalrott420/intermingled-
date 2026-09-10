/**
 * MatchmakingService owns the ranking and selection of suitors for live game
 * sessions. It should remain responsible for scoring and live pool filtering.
 *
 * It must never own game state transitions, room persistence, or socket events.
 */
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable, participantsTable, roomsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getIo } from "../socket";
import { buildRoomResponse } from "../lib/roomUtils";
import { fillBotsIfNeeded } from "./gameSessionService";
import {
  MAX_SUITORS,
  MIN_SUITORS,
  MAX_ALLOWED_SUITORS,
  PREMIUM_POOL_BOOST,
  DEFAULT_NUMBER_OF_ROUNDS,
  DEFAULT_ROUND_DURATION_SECONDS,
  ANSWER_TIME_SECONDS,
  ALLOWED_ROUND_COUNTS,
} from "./gameConstants";
import { checkAndCachePremiumEntitlement, getCachedPremiumByClerkId } from "./subscriptionService";
import { isUserInPool } from "./poolService";
import type { RoomQuestionConfig } from "./questionService";
import { selectRoundQuestionsForRoom } from "./questionService";
import { recordQuestionExposed } from "./questionTelemetryService";

export interface RankedSuitor<T> {
  suitor: T;
  score: number;
}

function makeId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Computes cosine similarity between two numeric vectors.
 *
 * @param a - first vector
 * @param b - second vector
 * @returns similarity score in range [0,1]
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Rank candidate suitors relative to the chooser's personality vector.
 * Premium suitors receive a small score boost without overriding compatibility.
 *
 * @param chooserVector - chooser personality vector
 * @param suitors - candidate suitors with personality vectors
 * @param topN - number of suitors to return
 */
export function rankSuitors<T extends { personalityVector: number[]; isPremium?: boolean }>(
  chooserVector: number[],
  suitors: T[],
  topN: number,
): T[] {
  const scored = suitors.map((s) => ({
    suitor: s,
    score: cosineSimilarity(chooserVector, s.personalityVector) + (s.isPremium ? PREMIUM_POOL_BOOST : 0),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  return scored.slice(0, topN).map((item) => item.suitor);
}

export async function createMatchSession(
  chooserUserId: string,
  maxSuitors: number | null = null,
  numberOfRounds: number | null = null,
  questionConfig: RoomQuestionConfig = {},
): Promise<{ roomData: import("../socket/events").RoomUpdatedPayload; chooserParticipantId: string }> {
  const normalizedSuitors = maxSuitors ?? MAX_SUITORS;
  if (normalizedSuitors < MIN_SUITORS || normalizedSuitors > MAX_ALLOWED_SUITORS) {
    throw new Error("Invalid maxSuitors");
  }
  const normalizedRounds = numberOfRounds ?? DEFAULT_NUMBER_OF_ROUNDS;
  if (!ALLOWED_ROUND_COUNTS.includes(normalizedRounds as any)) {
    throw new Error("Invalid numberOfRounds");
  }

  const chooser = await db.query.usersTable.findFirst({
    where: and(eq(usersTable.id, chooserUserId), eq(usersTable.role, "chooser")),
  });
  if (!chooser) throw new Error("Chooser user not found");
  if (!chooser.personalityVector) throw new Error("Chooser has no personality vector");

  const liveCandidates = await getLiveSuitors();
  const poolCandidates = liveCandidates.filter((u) => isUserInPool(u.id));
  const realSuitorCount = Math.min(poolCandidates.length, normalizedSuitors);
  const topSuitors = rankSuitors(chooser.personalityVector, poolCandidates, realSuitorCount);

  const roomId = makeId();
  const code = randomBytes(3).toString("hex").toUpperCase();

  await db.insert(roomsTable).values({
    id: roomId,
    code,
    chooserName: chooser.name,
    chooserUserId: chooser.id,
    status: "active",
    maxSuitors: normalizedSuitors,
    numberOfRounds: normalizedRounds,
    roundDurationSeconds: DEFAULT_ROUND_DURATION_SECONDS,
    answerTimeSeconds: ANSWER_TIME_SECONDS,
    questionConfig,
  });

  const firstRoundQuestions = await selectRoundQuestionsForRoom({
    roomId,
    round: 1,
    maxSuitors: normalizedSuitors,
    config: questionConfig,
  });
  const selectedIds = firstRoundQuestions.questions.map((question) => question.id).filter((id): id is string => Boolean(id));
  if (selectedIds.length > 0) {
    await db
      .update(roomsTable)
      .set({ currentRoundQuestionIds: selectedIds, usedQuestionIds: selectedIds })
      .where(eq(roomsTable.id, roomId));

    await Promise.all(
      firstRoundQuestions.questions
        .filter((question) => typeof question.id === "string" && question.id.length > 0)
        .map((question) =>
          recordQuestionExposed({
            roomId,
            questionId: question.id!,
            round: 1,
            packSlug: question.packSlug ?? "core",
            category: question.category,
            difficulty: question.difficulty,
          }),
        ),
    );
  }

  const chooserParticipantId = makeId();
  await db.insert(participantsTable).values({
    id: chooserParticipantId,
    roomId,
    userId: chooser.id,
    name: chooser.name,
    role: "chooser",
    suitorSlot: null,
  });

  await db.update(usersTable).set({ status: "in_room" }).where(eq(usersTable.id, chooser.id));

  const io = getIo();
  for (let i = 0; i < topSuitors.length; i += 1) {
    const suitor = topSuitors[i];
    const participantId = makeId();
    await db.insert(participantsTable).values({
      id: participantId,
      roomId,
      userId: suitor.id,
      name: suitor.name,
      role: "suitor",
      suitorSlot: i + 1,
      isPremium: suitor.isPremium,
    });
    await db.update(usersTable).set({ status: "matched" }).where(eq(usersTable.id, suitor.id));

    io.to(`user_${suitor.id}`).emit("match_found", { roomId, participantId });
    io.to(`user_${chooser.id}`).emit("slot_filled", {
      slot: i + 1,
      suitorName: suitor.name,
      participantId,
      roomId,
    });
  }

  await fillBotsIfNeeded(roomId);
  const roomData = await buildRoomResponse(roomId);
  if (!roomData) throw new Error("Failed to build room response");
  return { roomData, chooserParticipantId };
}

/**
 * Returns live suitors who are currently eligible for matchmaking.
 *
 * This helper reads users that are marked as looking and have a personality
 * vector. It also refreshes cached premium flags for ranking.
 */
export async function getLiveSuitors(): Promise<Array<{ id: string; clerkId: string | null; personalityVector: number[]; isPremium: boolean; name: string }>> {
  const dbCandidates = await db.query.usersTable.findMany({
    where: and(eq(usersTable.status, "looking"), eq(usersTable.role, "suitor")),
  });

  const liveCandidates = [] as Array<{ id: string; clerkId: string | null; personalityVector: number[]; isPremium: boolean; name: string }>;
  for (const candidate of dbCandidates) {
    if (!candidate.personalityVector) continue;
    const isPremium = candidate.clerkId ? await checkAndCachePremiumEntitlement(candidate.clerkId, candidate.id) : false;
    liveCandidates.push({
      id: candidate.id,
      clerkId: candidate.clerkId,
      personalityVector: candidate.personalityVector,
      isPremium,
      name: candidate.name,
    });
  }

  return liveCandidates;
}

/**
 * Reads the cached premium flag for a joining user by Clerk ID.
 *
 * @param clerkId - Clerk user ID for the joining user
 */
export async function getCachedPremiumForJoiningUser(clerkId: string | null): Promise<boolean> {
  if (!clerkId) return false;
  return getCachedPremiumByClerkId(clerkId);
}
