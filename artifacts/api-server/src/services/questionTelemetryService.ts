import { db, gameplayEventsTable, participantsTable, questionBankTable } from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { makeId } from "./utils";

type TelemetryResolutionReason = "timeout" | "skipped";
type QuestionResolutionReason = TelemetryResolutionReason;

type AskedTelemetry = {
  questionMessageId: string;
  round: number;
  suitorSlot: number;
  askedAt: string;
};

type ResolvedTelemetry = {
  questionMessageId: string;
};

type QuestionRatingSnapshot = {
  questionId: string;
  ratingCount: number;
  averageRating: number | null;
  qualityScore: number | null;
};

type QuestionPerformanceSnapshot = {
  questionId: string;
  content: string;
  packSlug: string;
  category: string;
  difficulty: string;
  usageCount: number;
  exposureCount: number;
  recentExposureCount: number;
  ratingCount: number;
  averageRating: number | null;
  completedCount: number;
  completionRate: number | null;
  skippedCount: number;
  skipRate: number | null;
  timeoutCount: number;
  timeoutRate: number | null;
  averageResponseTimeSeconds: number | null;
  confidenceScore: number;
  freshnessScore: number;
  qualityScore: number;
  suggestedArchive: boolean;
  suggestedPromote: boolean;
};

type QuestionGroupPerformanceSnapshot = {
  groupValue: string;
  questionCount: number;
  exposureCount: number;
  ratingCount: number;
  averageRating: number | null;
  averageQualityScore: number | null;
  completionRate: number | null;
  skipRate: number | null;
  timeoutRate: number | null;
  averageResponseTimeSeconds: number | null;
  suggestedArchiveCount: number;
  suggestedPromoteCount: number;
};

type QuestionTrendPoint = {
  bucket: string;
  exposureCount: number;
  ratingCount: number;
  averageRating: number | null;
  averageResponseTimeSeconds: number | null;
};

type QuestionIntelligenceDashboard = {
  leaderboard: QuestionPerformanceSnapshot[];
  lowestPerforming: QuestionPerformanceSnapshot[];
  packRankings: QuestionGroupPerformanceSnapshot[];
  categoryRankings: QuestionGroupPerformanceSnapshot[];
  difficultyRankings: QuestionGroupPerformanceSnapshot[];
  ratingTrends: QuestionTrendPoint[];
  responseTimeTrends: QuestionTrendPoint[];
  exposureMetrics: {
    activeQuestions: number;
    totalExposureCount: number;
    recentExposureCount: number;
    averageExposurePerQuestion: number;
    recentWindowDays: number;
  };
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function toGroupKey(input: string) {
  return input.trim().toLowerCase();
}

function toTrendBucket(input: Date) {
  return input.toISOString().slice(0, 10);
}

function buildResolutionKey(questionId: string, round: number | null | undefined) {
  return `${questionId}::${round ?? "any"}`;
}

function parseAskedPayload(payload: Record<string, unknown>): AskedTelemetry | null {
  const questionMessageId = asString(payload.questionMessageId);
  const round = asNumber(payload.round);
  const suitorSlot = asNumber(payload.suitorSlot);
  const askedAt = asString(payload.askedAt);

  if (!questionMessageId || round === null || suitorSlot === null || !askedAt) {
    return null;
  }

  return {
    questionMessageId,
    round,
    suitorSlot,
    askedAt,
  };
}

function parseResolvedPayload(payload: Record<string, unknown>): ResolvedTelemetry | null {
  const questionMessageId = asString(payload.questionMessageId);
  if (!questionMessageId) return null;
  return { questionMessageId };
}

function parseQuestionIdPayload(payload: Record<string, unknown>): { questionId: string; round: number | null; exposedAt: string | null } | null {
  const questionId = asString(payload.questionId);
  if (!questionId) return null;

  return {
    questionId,
    round: asNumber(payload.round),
    exposedAt: asString(payload.exposedAt),
  };
}

async function trackQuestionTelemetryEvent(
  eventType: string,
  payload: Record<string, unknown>,
  context: { roomId: string; participantId?: string | null; userId?: string | null },
) {
  try {
    await db.insert(gameplayEventsTable).values({
      id: makeId(),
      roomId: context.roomId,
      userId: context.userId ?? null,
      participantId: context.participantId ?? null,
      eventType,
      payload,
    });
  } catch {
    // Telemetry must never block gameplay.
  }
}

function scoreQuestionPerformance(snapshot: {
  averageRating: number | null;
  completionRate: number | null;
  skipRate: number | null;
  timeoutRate: number | null;
  averageResponseTimeSeconds: number | null;
  recentExposureCount: number;
  usageCount: number;
  exposureCount: number;
  ratingCount: number;
  completedCount: number;
  skippedCount: number;
  timeoutCount: number;
}) {
  const ratingScore = snapshot.averageRating === null ? 65 : clamp((snapshot.averageRating / 5) * 100, 0, 100);
  const completionScore = snapshot.completionRate === null ? 65 : clamp(snapshot.completionRate * 100, 0, 100);
  const responseScore = snapshot.averageResponseTimeSeconds === null ? 65 : clamp(100 - snapshot.averageResponseTimeSeconds * 4, 0, 100);
  const freshnessScore = clamp(100 - snapshot.recentExposureCount * 16 - Math.max(0, snapshot.usageCount - 3) * 4, 0, 100);

  const totalSignals = snapshot.exposureCount + snapshot.ratingCount + snapshot.completedCount + snapshot.skippedCount + snapshot.timeoutCount;
  const confidenceScore = clamp(Math.round(Math.min(1, totalSignals / 8) * 100), 0, 100);

  const skipPenalty = snapshot.skipRate === null ? 0 : snapshot.skipRate * 22;
  const timeoutPenalty = snapshot.timeoutRate === null ? 0 : snapshot.timeoutRate * 18;
  const usagePenalty = Math.min(18, Math.max(0, snapshot.usageCount - 2) * 2);

  const blendedScore =
    ratingScore * 0.32 +
    completionScore * 0.22 +
    responseScore * 0.18 +
    freshnessScore * 0.18 +
    confidenceScore * 0.10 -
    skipPenalty -
    timeoutPenalty -
    usagePenalty;

  return clamp(Math.round((blendedScore * (confidenceScore / 100)) + 65 * (1 - confidenceScore / 100)), 0, 100);
}

function buildPerformanceSnapshot(
  question: {
    id: string;
    content: string;
    packSlug: string;
    category: string;
    difficulty: string;
    usageCount: number;
  },
  metrics: {
    exposureCount: number;
    recentExposureCount: number;
    ratingCount: number;
    averageRating: number | null;
    completedCount: number;
    skippedCount: number;
    timeoutCount: number;
    averageResponseTimeSeconds: number | null;
  },
): QuestionPerformanceSnapshot {
  const completionRate = safeDivide(metrics.completedCount, metrics.exposureCount);
  const skipRate = safeDivide(metrics.skippedCount, metrics.exposureCount);
  const timeoutRate = safeDivide(metrics.timeoutCount, metrics.exposureCount);
  const confidenceScore = clamp(Math.round(Math.min(1, (metrics.exposureCount + metrics.ratingCount + metrics.completedCount + metrics.skippedCount + metrics.timeoutCount) / 8) * 100), 0, 100);
  const freshnessScore = clamp(100 - metrics.recentExposureCount * 16 - Math.max(0, question.usageCount - 3) * 4, 0, 100);
  const qualityScore = scoreQuestionPerformance({
    ...metrics,
    completionRate,
    skipRate,
    timeoutRate,
    usageCount: question.usageCount,
  });

  return {
    questionId: question.id,
    content: question.content,
    packSlug: question.packSlug,
    category: question.category,
    difficulty: question.difficulty,
    usageCount: question.usageCount,
    exposureCount: metrics.exposureCount,
    recentExposureCount: metrics.recentExposureCount,
    ratingCount: metrics.ratingCount,
    averageRating: metrics.averageRating,
    completedCount: metrics.completedCount,
    completionRate,
    skippedCount: metrics.skippedCount,
    skipRate,
    timeoutCount: metrics.timeoutCount,
    timeoutRate,
    averageResponseTimeSeconds: metrics.averageResponseTimeSeconds,
    confidenceScore,
    freshnessScore,
    qualityScore,
    suggestedArchive: confidenceScore >= 45 && qualityScore < 40 && (metrics.exposureCount >= 4 || metrics.ratingCount >= 3),
    suggestedPromote: confidenceScore >= 45 && qualityScore >= 78 && (skipRate === null || skipRate <= 0.15) && (timeoutRate === null || timeoutRate <= 0.15),
  };
}

function aggregateGroupPerformance(
  groupValue: string,
  snapshots: QuestionPerformanceSnapshot[],
): QuestionGroupPerformanceSnapshot {
  const count = snapshots.length;
  if (count === 0) {
    return {
      groupValue,
      questionCount: 0,
      exposureCount: 0,
      ratingCount: 0,
      averageRating: null,
      averageQualityScore: null,
      completionRate: null,
      skipRate: null,
      timeoutRate: null,
      averageResponseTimeSeconds: null,
      suggestedArchiveCount: 0,
      suggestedPromoteCount: 0,
    };
  }

  const exposureCount = snapshots.reduce((sum, snapshot) => sum + snapshot.exposureCount, 0);
  const ratingCount = snapshots.reduce((sum, snapshot) => sum + snapshot.ratingCount, 0);
  const completedCount = snapshots.reduce((sum, snapshot) => sum + snapshot.completedCount, 0);
  const skippedCount = snapshots.reduce((sum, snapshot) => sum + snapshot.skippedCount, 0);
  const timeoutCount = snapshots.reduce((sum, snapshot) => sum + snapshot.timeoutCount, 0);
  const totalWeightedQuality = snapshots.reduce((sum, snapshot) => sum + snapshot.qualityScore * Math.max(1, snapshot.exposureCount), 0);
  const totalWeightedRating = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.averageRating ?? 0) * Math.max(1, snapshot.ratingCount),
    0,
  );
  const totalWeightedResponse = snapshots.reduce(
    (sum, snapshot) => sum + (snapshot.averageResponseTimeSeconds ?? 0) * Math.max(1, snapshot.completedCount),
    0,
  );
  const responseWeight = snapshots.reduce((sum, snapshot) => sum + Math.max(1, snapshot.completedCount), 0);
  const qualityWeight = snapshots.reduce((sum, snapshot) => sum + Math.max(1, snapshot.exposureCount), 0);
  const ratingWeight = snapshots.reduce((sum, snapshot) => sum + Math.max(1, snapshot.ratingCount), 0);

  return {
    groupValue,
    questionCount: count,
    exposureCount,
    ratingCount,
    averageRating: ratingWeight > 0 ? Number((totalWeightedRating / ratingWeight).toFixed(2)) : null,
    averageQualityScore: qualityWeight > 0 ? Number((totalWeightedQuality / qualityWeight).toFixed(2)) : null,
    completionRate: safeDivide(completedCount, exposureCount),
    skipRate: safeDivide(skippedCount, exposureCount),
    timeoutRate: safeDivide(timeoutCount, exposureCount),
    averageResponseTimeSeconds: responseWeight > 0 ? Number((totalWeightedResponse / responseWeight).toFixed(2)) : null,
    suggestedArchiveCount: snapshots.filter((snapshot) => snapshot.suggestedArchive).length,
    suggestedPromoteCount: snapshots.filter((snapshot) => snapshot.suggestedPromote).length,
  };
}

function buildTrendPoints(events: Array<{ eventType: string; payload: Record<string, unknown>; createdAt: Date }>): {
  ratingTrends: QuestionTrendPoint[];
  responseTimeTrends: QuestionTrendPoint[];
} {
  const byBucket = new Map<string, { exposureCount: number; ratingCount: number; ratingTotal: number; responseCount: number; responseTotal: number }>();

  for (const event of events) {
    const bucket = toTrendBucket(event.createdAt);
    const current = byBucket.get(bucket) ?? { exposureCount: 0, ratingCount: 0, ratingTotal: 0, responseCount: 0, responseTotal: 0 };

    if (event.eventType === "question_exposed") {
      current.exposureCount += 1;
    }

    if (event.eventType === "question_rated") {
      const rating = asNumber(event.payload.rating);
      if (rating !== null) {
        current.ratingCount += 1;
        current.ratingTotal += rating;
      }
    }

    if (event.eventType === "question_completed") {
      const responseTimeSeconds = asNumber(event.payload.responseTimeSeconds);
      if (responseTimeSeconds !== null) {
        current.responseCount += 1;
        current.responseTotal += responseTimeSeconds;
      }
    }

    byBucket.set(bucket, current);
  }

  const buckets = [...byBucket.entries()].sort(([left], [right]) => left.localeCompare(right));
  return {
    ratingTrends: buckets.map(([bucket, metrics]) => ({
      bucket,
      exposureCount: metrics.exposureCount,
      ratingCount: metrics.ratingCount,
      averageRating: metrics.ratingCount > 0 ? Number((metrics.ratingTotal / metrics.ratingCount).toFixed(2)) : null,
      averageResponseTimeSeconds: null,
    })),
    responseTimeTrends: buckets.map(([bucket, metrics]) => ({
      bucket,
      exposureCount: metrics.exposureCount,
      ratingCount: metrics.responseCount,
      averageRating: null,
      averageResponseTimeSeconds: metrics.responseCount > 0 ? Number((metrics.responseTotal / metrics.responseCount).toFixed(2)) : null,
    })),
  };
}

async function findOutstandingQuestion(
  roomId: string,
  round: number,
  suitorSlot: number,
): Promise<{ questionMessageId: string; askedAt: string } | null> {
  let telemetryEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  try {
    telemetryEvents = await db.query.gameplayEventsTable.findMany({
      where: and(
        eq(gameplayEventsTable.roomId, roomId),
        inArray(gameplayEventsTable.eventType, [
          "question_asked",
          "question_completed",
          "question_timeout",
          "question_skipped",
        ]),
      ),
      orderBy: [desc(gameplayEventsTable.createdAt)],
    });
  } catch {
    return null;
  }

  const resolvedQuestionIds = new Set<string>();
  for (const event of telemetryEvents) {
    if (event.eventType !== "question_asked") {
      const resolved = parseResolvedPayload(event.payload ?? {});
      if (resolved) {
        resolvedQuestionIds.add(resolved.questionMessageId);
      }
      continue;
    }

    const asked = parseAskedPayload(event.payload ?? {});
    if (!asked) continue;
    if (asked.round !== round || asked.suitorSlot !== suitorSlot) continue;
    if (!resolvedQuestionIds.has(asked.questionMessageId)) {
      return { questionMessageId: asked.questionMessageId, askedAt: asked.askedAt };
    }
  }

  return null;
}

export async function recordQuestionAsked(input: {
  roomId: string;
  participantId: string;
  round: number;
  suitorSlot: number;
  questionMessageId: string;
  askedAtIso: string;
  questionLength: number;
}) {
  await trackQuestionTelemetryEvent(
    "question_asked",
    {
      questionMessageId: input.questionMessageId,
      round: input.round,
      suitorSlot: input.suitorSlot,
      askedAt: input.askedAtIso,
      questionLength: input.questionLength,
    },
    {
      roomId: input.roomId,
      participantId: input.participantId,
    },
  );
}

export async function recordQuestionExposed(input: {
  roomId: string;
  questionId: string;
  round: number;
  packSlug: string;
  category: string;
  difficulty: string;
  userId?: string | null;
  participantId?: string | null;
}) {
  await trackQuestionTelemetryEvent(
    "question_exposed",
    {
      questionId: input.questionId,
      round: input.round,
      packSlug: input.packSlug,
      category: input.category,
      difficulty: input.difficulty,
      exposedAt: new Date().toISOString(),
    },
    {
      roomId: input.roomId,
      userId: input.userId ?? null,
      participantId: input.participantId ?? null,
    },
  );
}

export async function recordQuestionAnswered(input: {
  roomId: string;
  participantId: string;
  round: number;
  suitorSlot: number;
  answerMessageId: string;
  answeredAtIso: string;
  responseLength: number;
}) {
  const outstanding = await findOutstandingQuestion(input.roomId, input.round, input.suitorSlot);
  if (!outstanding) return;

  const responseTimeSeconds = Math.max(
    0,
    Math.round((Date.parse(input.answeredAtIso) - Date.parse(outstanding.askedAt)) / 1000),
  );

  await trackQuestionTelemetryEvent(
    "question_completed",
    {
      questionMessageId: outstanding.questionMessageId,
      answerMessageId: input.answerMessageId,
      round: input.round,
      suitorSlot: input.suitorSlot,
      answeredAt: input.answeredAtIso,
      responseTimeSeconds,
      responseLength: input.responseLength,
    },
    {
      roomId: input.roomId,
      participantId: input.participantId,
    },
  );
}

export async function recordQuestionRated(input: {
  roomId: string;
  participantId?: string | null;
  userId?: string | null;
  questionId: string;
  round: number;
  rating: number;
  packSlug: string;
  category: string;
  difficulty: string;
}) {
  await trackQuestionTelemetryEvent(
    "question_rated",
    {
      questionId: input.questionId,
      round: input.round,
      rating: input.rating,
      packSlug: input.packSlug,
      category: input.category,
      difficulty: input.difficulty,
      qualityScore: Math.max(0, Math.min(100, Math.round((input.rating / 5) * 100))),
    },
    {
      roomId: input.roomId,
      participantId: input.participantId ?? null,
      userId: input.userId ?? null,
    },
  );
}

export async function finalizeRoomQuestionExposures(input: {
  roomId: string;
  round: number;
  questionIds: string[];
  reason: QuestionResolutionReason;
}) {
  const uniqueQuestionIds = [...new Set(input.questionIds.filter(Boolean))];
  if (uniqueQuestionIds.length === 0) return;

  let telemetryEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  try {
    telemetryEvents = await db.query.gameplayEventsTable.findMany({
      where: and(
        eq(gameplayEventsTable.roomId, input.roomId),
        inArray(gameplayEventsTable.eventType, ["question_exposed", "question_rated", "question_timeout", "question_skipped"]),
      ),
      orderBy: [asc(gameplayEventsTable.createdAt)],
    });
  } catch {
    return;
  }

  const resolvedExposureKeys = new Set<string>();
  for (const event of telemetryEvents) {
    const payloadQuestionId = asString(event.payload?.questionId);
    const round = asNumber(event.payload?.round);
    if (!payloadQuestionId) continue;

    const key = buildResolutionKey(payloadQuestionId, round);
    if (event.eventType === "question_exposed") {
      if (round === input.round && uniqueQuestionIds.includes(payloadQuestionId) && !resolvedExposureKeys.has(key)) {
        resolvedExposureKeys.add(key);
      }
      continue;
    }

    if (event.eventType === "question_rated" || event.eventType === "question_timeout" || event.eventType === "question_skipped") {
      resolvedExposureKeys.add(key);
    }
  }

  for (const questionId of uniqueQuestionIds) {
    const key = buildResolutionKey(questionId, input.round);
    if (resolvedExposureKeys.has(key)) continue;

    await trackQuestionTelemetryEvent(
      input.reason === "timeout" ? "question_timeout" : "question_skipped",
      {
        questionId,
        round: input.round,
        reason: input.reason,
      },
      { roomId: input.roomId },
    );
  }
}

export async function getQuestionPerformanceSnapshots(questionIds: string[], recentExposureWindowDays = 14): Promise<Map<string, QuestionPerformanceSnapshot>> {
  const uniqueIds = [...new Set(questionIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const uniqueIdSet = new Set(uniqueIds);
  let questionRows: Array<{ id: string; content: string; packSlug: string; category: string; difficulty: string; usageCount: number }> = [];
  let events: Array<{ eventType: string; payload: Record<string, unknown>; createdAt: Date }> = [];

  try {
    [questionRows, events] = await Promise.all([
      db.query.questionBankTable.findMany({
        where: inArray(questionBankTable.id, uniqueIds),
      }),
      db.query.gameplayEventsTable.findMany({
        where: inArray(gameplayEventsTable.eventType, ["question_exposed", "question_rated", "question_timeout", "question_skipped"]),
        orderBy: [asc(gameplayEventsTable.createdAt)],
      }),
    ]);
  } catch {
    return new Map();
  }

  const metricsByQuestion = new Map<string, {
    exposureCount: number;
    recentExposureCount: number;
    ratingCount: number;
    ratingTotal: number;
    completedCount: number;
    skippedCount: number;
    timeoutCount: number;
    responseTotal: number;
    responseCount: number;
    exposureQueue: Date[];
  }>();

  const recentExposureCutoff = Date.now() - recentExposureWindowDays * 24 * 60 * 60 * 1000;

  for (const row of questionRows) {
    metricsByQuestion.set(row.id, {
      exposureCount: 0,
      recentExposureCount: 0,
      ratingCount: 0,
      ratingTotal: 0,
      completedCount: 0,
      skippedCount: 0,
      timeoutCount: 0,
      responseTotal: 0,
      responseCount: 0,
      exposureQueue: [],
    });
  }

  for (const event of events) {
    const questionId = asString(event.payload?.questionId);
    if (!questionId || !uniqueIdSet.has(questionId)) continue;

    const metrics = metricsByQuestion.get(questionId);
    if (!metrics) continue;

    if (event.eventType === "question_exposed") {
      metrics.exposureCount += 1;
      metrics.exposureQueue.push(event.createdAt);
      if (event.createdAt.getTime() >= recentExposureCutoff) {
        metrics.recentExposureCount += 1;
      }
      continue;
    }

    const round = asNumber(event.payload?.round);
    const roundAwareQueue = metrics.exposureQueue;

    if (event.eventType === "question_rated") {
      const rating = asNumber(event.payload?.rating);
      if (rating !== null) {
        metrics.ratingCount += 1;
        metrics.ratingTotal += rating;
      }

      if (roundAwareQueue.length > 0) {
        const exposureAt = roundAwareQueue.shift()!;
        metrics.completedCount += 1;
        metrics.responseCount += 1;
        metrics.responseTotal += Math.max(0, (event.createdAt.getTime() - exposureAt.getTime()) / 1000);
      }
      continue;
    }

    if (event.eventType === "question_timeout" || event.eventType === "question_skipped") {
      if (roundAwareQueue.length > 0) {
        roundAwareQueue.shift();
        if (event.eventType === "question_timeout") {
          metrics.timeoutCount += 1;
        } else {
          metrics.skippedCount += 1;
        }
      }
    }

    if (round === null) continue;
  }

  const result = new Map<string, QuestionPerformanceSnapshot>();
  for (const row of questionRows) {
    const metrics = metricsByQuestion.get(row.id) ?? {
      exposureCount: 0,
      recentExposureCount: 0,
      ratingCount: 0,
      ratingTotal: 0,
      completedCount: 0,
      skippedCount: 0,
      timeoutCount: 0,
      responseTotal: 0,
      responseCount: 0,
      exposureQueue: [],
    };

    const averageRating = metrics.ratingCount > 0 ? Number((metrics.ratingTotal / metrics.ratingCount).toFixed(2)) : null;
    const averageResponseTimeSeconds = metrics.responseCount > 0 ? Number((metrics.responseTotal / metrics.responseCount).toFixed(2)) : null;
    const completionRate = safeDivide(metrics.completedCount, metrics.exposureCount);
    const skipRate = safeDivide(metrics.skippedCount, metrics.exposureCount);
    const timeoutRate = safeDivide(metrics.timeoutCount, metrics.exposureCount);
    const confidenceScore = clamp(Math.round(Math.min(1, (metrics.exposureCount + metrics.ratingCount + metrics.completedCount + metrics.skippedCount + metrics.timeoutCount) / 8) * 100), 0, 100);
    const freshnessScore = clamp(100 - metrics.recentExposureCount * 16 - Math.max(0, row.usageCount - 3) * 4, 0, 100);
    const qualityScore = scoreQuestionPerformance({
      averageRating,
      completionRate,
      skipRate,
      timeoutRate,
      averageResponseTimeSeconds,
      recentExposureCount: metrics.recentExposureCount,
      usageCount: row.usageCount,
      exposureCount: metrics.exposureCount,
      ratingCount: metrics.ratingCount,
      completedCount: metrics.completedCount,
      skippedCount: metrics.skippedCount,
      timeoutCount: metrics.timeoutCount,
    });

    result.set(row.id, {
      questionId: row.id,
      content: row.content,
      packSlug: row.packSlug,
      category: row.category,
      difficulty: row.difficulty,
      usageCount: row.usageCount,
      exposureCount: metrics.exposureCount,
      recentExposureCount: metrics.recentExposureCount,
      ratingCount: metrics.ratingCount,
      averageRating,
      completedCount: metrics.completedCount,
      completionRate,
      skippedCount: metrics.skippedCount,
      skipRate,
      timeoutCount: metrics.timeoutCount,
      timeoutRate,
      averageResponseTimeSeconds,
      confidenceScore,
      freshnessScore,
      qualityScore,
      suggestedArchive: confidenceScore >= 45 && qualityScore < 40 && (metrics.exposureCount >= 4 || metrics.ratingCount >= 3),
      suggestedPromote: confidenceScore >= 45 && qualityScore >= 78 && (skipRate === null || skipRate <= 0.15) && (timeoutRate === null || timeoutRate <= 0.15),
    });
  }

  return result;
}

export async function getQuestionRatingSnapshots(questionIds: string[]): Promise<Map<string, QuestionRatingSnapshot>> {
  const performanceSnapshots = await getQuestionPerformanceSnapshots(questionIds);
  const result = new Map<string, QuestionRatingSnapshot>();

  for (const questionId of [...new Set(questionIds.filter(Boolean))]) {
    const snapshot = performanceSnapshots.get(questionId);
    if (!snapshot) {
      result.set(questionId, { questionId, ratingCount: 0, averageRating: null, qualityScore: null });
      continue;
    }

    result.set(questionId, {
      questionId,
      ratingCount: snapshot.ratingCount,
      averageRating: snapshot.averageRating,
      qualityScore: snapshot.qualityScore,
    });
  }

  return result;
}

export async function getQuestionIntelligenceDashboard(limit = 20, recentExposureWindowDays = 14): Promise<QuestionIntelligenceDashboard> {
  const questions = await db.query.questionBankTable.findMany({
    where: eq(questionBankTable.isActive, true),
  });
  const ids = questions.map((question) => question.id);
  const performanceMap = await getQuestionPerformanceSnapshots(ids, recentExposureWindowDays);
  const snapshots = questions
    .map((question) => performanceMap.get(question.id))
    .filter((snapshot): snapshot is QuestionPerformanceSnapshot => snapshot !== undefined)
    .sort((left, right) => {
      const scoreDelta = right.qualityScore - left.qualityScore;
      if (scoreDelta !== 0) return scoreDelta;
      const confidenceDelta = right.confidenceScore - left.confidenceScore;
      if (confidenceDelta !== 0) return confidenceDelta;
      return right.exposureCount - left.exposureCount;
    });

  const leaderboard = snapshots.slice(0, limit);
  const lowestPerforming = [...snapshots].sort((left, right) => left.qualityScore - right.qualityScore).slice(0, limit);

  const packGroups = new Map<string, QuestionPerformanceSnapshot[]>();
  const categoryGroups = new Map<string, QuestionPerformanceSnapshot[]>();
  const difficultyGroups = new Map<string, QuestionPerformanceSnapshot[]>();

  for (const snapshot of snapshots) {
    const packGroup = packGroups.get(snapshot.packSlug) ?? [];
    packGroup.push(snapshot);
    packGroups.set(snapshot.packSlug, packGroup);

    const categoryGroup = categoryGroups.get(snapshot.category) ?? [];
    categoryGroup.push(snapshot);
    categoryGroups.set(snapshot.category, categoryGroup);

    const difficultyGroup = difficultyGroups.get(snapshot.difficulty) ?? [];
    difficultyGroup.push(snapshot);
    difficultyGroups.set(snapshot.difficulty, difficultyGroup);
  }

  const packRankings = [...packGroups.entries()].map(([groupValue, rows]) => aggregateGroupPerformance(groupValue, rows)).sort((left, right) => (right.averageQualityScore ?? 0) - (left.averageQualityScore ?? 0));
  const categoryRankings = [...categoryGroups.entries()].map(([groupValue, rows]) => aggregateGroupPerformance(groupValue, rows)).sort((left, right) => (right.averageQualityScore ?? 0) - (left.averageQualityScore ?? 0));
  const difficultyRankings = [...difficultyGroups.entries()].map(([groupValue, rows]) => aggregateGroupPerformance(groupValue, rows)).sort((left, right) => (right.averageQualityScore ?? 0) - (left.averageQualityScore ?? 0));

  const trends = buildTrendPoints(
    await db.query.gameplayEventsTable.findMany({
      where: inArray(gameplayEventsTable.eventType, ["question_exposed", "question_rated", "question_completed"]),
      orderBy: [asc(gameplayEventsTable.createdAt)],
    }),
  );

  const totalExposureCount = snapshots.reduce((sum, snapshot) => sum + snapshot.exposureCount, 0);
  const recentExposureCount = snapshots.reduce((sum, snapshot) => sum + snapshot.recentExposureCount, 0);

  return {
    leaderboard,
    lowestPerforming,
    packRankings,
    categoryRankings,
    difficultyRankings,
    ratingTrends: trends.ratingTrends,
    responseTimeTrends: trends.responseTimeTrends,
    exposureMetrics: {
      activeQuestions: snapshots.length,
      totalExposureCount,
      recentExposureCount,
      averageExposurePerQuestion: snapshots.length > 0 ? Number((totalExposureCount / snapshots.length).toFixed(2)) : 0,
      recentWindowDays: recentExposureWindowDays,
    },
  };
}

export async function finalizeOutstandingQuestions(input: {
  roomId: string;
  round: number;
  reason: TelemetryResolutionReason;
  suitorSlot?: number;
}) {
  let telemetryEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  try {
    telemetryEvents = await db.query.gameplayEventsTable.findMany({
      where: and(
        eq(gameplayEventsTable.roomId, input.roomId),
        inArray(gameplayEventsTable.eventType, [
          "question_asked",
          "question_completed",
          "question_timeout",
          "question_skipped",
        ]),
      ),
      orderBy: [desc(gameplayEventsTable.createdAt)],
    });
  } catch {
    return;
  }

  const resolvedQuestionIds = new Set<string>();
  const outstandingByQuestion = new Map<string, AskedTelemetry>();

  for (const event of telemetryEvents) {
    if (event.eventType === "question_asked") {
      const asked = parseAskedPayload(event.payload ?? {});
      if (!asked) continue;
      if (asked.round !== input.round) continue;
      if (typeof input.suitorSlot === "number" && asked.suitorSlot !== input.suitorSlot) continue;
      if (!resolvedQuestionIds.has(asked.questionMessageId) && !outstandingByQuestion.has(asked.questionMessageId)) {
        outstandingByQuestion.set(asked.questionMessageId, asked);
      }
      continue;
    }

    const resolved = parseResolvedPayload(event.payload ?? {});
    if (!resolved) continue;
    resolvedQuestionIds.add(resolved.questionMessageId);
    outstandingByQuestion.delete(resolved.questionMessageId);
  }

  if (outstandingByQuestion.size === 0) return;

  for (const asked of outstandingByQuestion.values()) {
    await trackQuestionTelemetryEvent(
      input.reason === "timeout" ? "question_timeout" : "question_skipped",
      {
        questionMessageId: asked.questionMessageId,
        round: asked.round,
        suitorSlot: asked.suitorSlot,
        reason: input.reason,
      },
      {
        roomId: input.roomId,
      },
    );
  }
}

export async function getSuitorSlotForParticipant(roomId: string, participantId: string): Promise<number | null> {
  const participant = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.roomId, roomId), eq(participantsTable.id, participantId)),
  });
  return participant?.suitorSlot ?? null;
}