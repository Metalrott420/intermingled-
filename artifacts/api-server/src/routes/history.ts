import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import {
  db,
  gameArchivesTable,
  gameplayEventsTable,
  playerGameHistoryTable,
  playerGameStatsTable,
  usersTable,
} from "@workspace/db";
import { logger } from "../lib/logger";

type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  target: number;
  getProgress: (input: DerivedStats) => number;
};

type DerivedStats = {
  gamesPlayed: number;
  wins: number;
  matches: number;
  winPercentage: number;
  matchPercentage: number;
  averageFinish: number;
  averageResponseTimeSeconds: number | null;
  streaks: {
    currentWinStreak: number;
    maxWinStreak: number;
    currentMatchStreak: number;
    maxMatchStreak: number;
  };
};

type QuestionTelemetrySummary = {
  askedCount: number;
  completedCount: number;
  skippedCount: number;
  timeoutCount: number;
  ratedCount: number;
  averageResponseTimeSeconds: number | null;
  averageRating: number | null;
};

const router: IRouter = Router();

type HistoryCursor = {
  completionTimestamp: string;
  gameId: string;
};

type HistorySortOrder = "newest" | "oldest";

type ApiErrorCode = "unauthorized" | "forbidden" | "not_found" | "invalid_query" | "internal_error";

function sendError(res: any, status: number, code: ApiErrorCode, error: string, details?: Record<string, unknown>) {
  res.status(status).json({
    error,
    code,
    ...(details ? { details } : {}),
  });
}

function parseBoolean(input: unknown): boolean | null {
  if (typeof input !== "string") return null;
  if (input === "true") return true;
  if (input === "false") return false;
  return null;
}

function parseHistorySortOrder(input: unknown): HistorySortOrder {
  return input === "oldest" ? "oldest" : "newest";
}

function decodeCursor(input: unknown): HistoryCursor | null {
  if (typeof input !== "string" || input.length === 0) return null;

  try {
    const parsed = JSON.parse(Buffer.from(input, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.completionTimestamp === "string" &&
      typeof parsed.gameId === "string"
    ) {
      return {
        completionTimestamp: parsed.completionTimestamp,
        gameId: parsed.gameId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function encodeCursor(input: HistoryCursor): string {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function normalizeQuestionTelemetrySummary(metadata: Record<string, unknown> | null | undefined): QuestionTelemetrySummary {
  const raw = metadata?.questionTelemetrySummary;
  const value = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const toInt = (input: unknown) => (typeof input === "number" && Number.isFinite(input) ? Math.max(0, Math.floor(input)) : 0);
  const toNullableNumber = (input: unknown) => (typeof input === "number" && Number.isFinite(input) ? input : null);

  return {
    askedCount: toInt(value.askedCount),
    completedCount: toInt(value.completedCount),
    skippedCount: toInt(value.skippedCount),
    timeoutCount: toInt(value.timeoutCount),
    ratedCount: toInt(value.ratedCount),
    averageResponseTimeSeconds: toNullableNumber(value.averageResponseTimeSeconds),
    averageRating: toNullableNumber(value.averageRating),
  };
}

type ReplayRound = {
  round: number;
  durationSeconds: number;
  questions: Array<{
    participantId: string;
    suitorSlot: number | null;
    content: string;
    createdAt: string;
  }>;
  eliminatedParticipantIds: string[];
};

function buildReplayRounds(input: {
  roundDurations: number[];
  questionsAsked: Array<{ participantId: string; suitorSlot: number | null; round: number | null; content: string; createdAt: string }>;
  eliminationByRound: Map<number, string[]>;
}): ReplayRound[] {
  return input.roundDurations.map((durationSeconds, index) => {
    const round = index + 1;
    const questions = input.questionsAsked
      .filter((question) => question.round === round)
      .map((question) => ({
        participantId: question.participantId,
        suitorSlot: question.suitorSlot,
        content: question.content,
        createdAt: question.createdAt,
      }));

    return {
      round,
      durationSeconds,
      questions,
      eliminatedParticipantIds: input.eliminationByRound.get(round) ?? [],
    };
  });
}

async function getArchiveMap(roomIds: string[]) {
  const uniqueRoomIds = [...new Set(roomIds)];

  const archives = await Promise.all(
    uniqueRoomIds.map((roomId) => db.query.gameArchivesTable.findFirst({ where: eq(gameArchivesTable.roomId, roomId) })),
  );

  const map = new Map<string, (typeof archives)[number]>();
  uniqueRoomIds.forEach((roomId, index) => {
    map.set(roomId, archives[index]);
  });

  return map;
}

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    sendError(res, 401, "unauthorized", "Unauthorized");
    return;
  }
  req.clerkUserId = auth.userId;
  next();
};

async function getDbUser(clerkUserId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkUserId) });
}

async function requireAdmin(req: any, res: any, next: any) {
  const user = await getDbUser(req.clerkUserId);
  if (!user?.isAdmin) {
    sendError(res, 403, "forbidden", "Forbidden");
    return;
  }
  req.dbUser = user;
  next();
}

function toInt(input: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(input ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function computeStreaks(historyRows: Array<{ isWinner: boolean; matchStatus: string }>) {
  let currentWinStreak = 0;
  let currentMatchStreak = 0;
  let maxWinStreak = 0;
  let maxMatchStreak = 0;
  let runningWin = 0;
  let runningMatch = 0;

  for (let i = 0; i < historyRows.length; i += 1) {
    const row = historyRows[i]!;

    if (row.isWinner) {
      runningWin += 1;
    } else {
      runningWin = 0;
    }

    if (row.matchStatus === "matched") {
      runningMatch += 1;
    } else {
      runningMatch = 0;
    }

    if (i === 0) {
      currentWinStreak = runningWin;
      currentMatchStreak = runningMatch;
    }

    maxWinStreak = Math.max(maxWinStreak, runningWin);
    maxMatchStreak = Math.max(maxMatchStreak, runningMatch);
  }

  return {
    currentWinStreak,
    maxWinStreak,
    currentMatchStreak,
    maxMatchStreak,
  };
}

function buildAchievements(stats: DerivedStats) {
  const definitions: AchievementDefinition[] = [
    {
      id: "first_game",
      title: "First Dance",
      description: "Complete your first game.",
      target: 1,
      getProgress: (s) => s.gamesPlayed,
    },
    {
      id: "first_win",
      title: "Crown Claimed",
      description: "Win your first game.",
      target: 1,
      getProgress: (s) => s.wins,
    },
    {
      id: "first_match",
      title: "Spark",
      description: "Create your first match.",
      target: 1,
      getProgress: (s) => s.matches,
    },
    {
      id: "win_streak_3",
      title: "Hat Trick",
      description: "Reach a 3-game win streak.",
      target: 3,
      getProgress: (s) => s.streaks.maxWinStreak,
    },
    {
      id: "survivor_rounds_20",
      title: "Lasting Impression",
      description: "Survive 20 rounds total.",
      target: 20,
      getProgress: (s) => Math.round(s.averageFinish * s.gamesPlayed),
    },
    {
      id: "veteran_25",
      title: "Ballroom Veteran",
      description: "Play 25 games.",
      target: 25,
      getProgress: (s) => s.gamesPlayed,
    },
  ];

  return definitions.map((definition) => {
    const progress = definition.getProgress(stats);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      target: definition.target,
      progress,
      unlocked: progress >= definition.target,
    };
  });
}

async function getDerivedStatsForUser(userId: string): Promise<DerivedStats> {
  const statsRow = await db.query.playerGameStatsTable.findFirst({
    where: eq(playerGameStatsTable.userId, userId),
  });

  const historyRows = await db.query.playerGameHistoryTable.findMany({
    where: eq(playerGameHistoryTable.userId, userId),
    orderBy: (table, { desc: descFn }) => [descFn(table.completionTimestamp)],
  });

  const gamesPlayed = statsRow?.gamesPlayed ?? historyRows.length;
  const wins = statsRow?.wins ?? historyRows.filter((row) => row.isWinner).length;
  const matches = statsRow?.matches ?? historyRows.filter((row) => row.matchStatus === "matched").length;

  const averageFinish =
    gamesPlayed > 0
      ? Number((historyRows.reduce((sum, row) => sum + (row.roundsSurvived ?? 0), 0) / gamesPlayed).toFixed(2))
      : 0;

  const relatedRoomIds = [...new Set(historyRows.map((row) => row.roomId))];
  let averageResponseTimeSeconds: number | null = null;

  if (relatedRoomIds.length > 0) {
    const archiveMap = await getArchiveMap(relatedRoomIds);
    const archives = [...archiveMap.values()];

    const responseTimes = archives
      .filter((archive): archive is NonNullable<typeof archive> => archive !== undefined)
      .map((archive) => {
        const summary = normalizeQuestionTelemetrySummary(archive.analyticsMetadata);
        if (typeof summary.averageResponseTimeSeconds === "number") {
          return summary.averageResponseTimeSeconds;
        }

        const legacyValue = archive.analyticsMetadata?.averageResponseTimeSeconds;
        return typeof legacyValue === "number" ? legacyValue : null;
      })
      .filter((value): value is number => value !== null);

    if (responseTimes.length > 0) {
      averageResponseTimeSeconds = Number(
        (responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(2),
      );
    }
  }

  const streaks = computeStreaks(historyRows.map((row) => ({ isWinner: row.isWinner, matchStatus: row.matchStatus })));

  return {
    gamesPlayed,
    wins,
    matches,
    winPercentage: gamesPlayed > 0 ? Number(((wins / gamesPlayed) * 100).toFixed(2)) : 0,
    matchPercentage: gamesPlayed > 0 ? Number(((matches / gamesPlayed) * 100).toFixed(2)) : 0,
    averageFinish,
    averageResponseTimeSeconds,
    streaks,
  };
}

router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const user = await getDbUser(req.clerkUserId);
    if (!user) {
      sendError(res, 404, "not_found", "User not found");
      return;
    }

    const page = toInt(req.query.page, 1, 1, 10_000);
    const limit = toInt(req.query.limit, 20, 1, 100);
    const cursor = decodeCursor(req.query.cursor);
    if (req.query.cursor && !cursor) {
      sendError(res, 400, "invalid_query", "Invalid cursor format", { query: "cursor" });
      return;
    }

    const roleFilter = req.query.role === "chooser" || req.query.role === "suitor" ? req.query.role : null;
    const isWinnerFilter = parseBoolean(req.query.isWinner);
    const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
    const sortOrder = parseHistorySortOrder(req.query.sort);
    const matchStatusFilter =
      req.query.matchStatus === "matched" || req.query.matchStatus === "unmatched" || req.query.matchStatus === "unknown"
        ? req.query.matchStatus
        : null;
    const useCursorPagination = Boolean(cursor);

    const allRows = await db.query.playerGameHistoryTable.findMany({
      where: eq(playerGameHistoryTable.userId, user.id),
      orderBy: (table, helpers) =>
        sortOrder === "oldest"
          ? [helpers.asc(table.completionTimestamp)]
          : [helpers.desc(table.completionTimestamp)],
    });

    const sortedRows = [...allRows].sort((left, right) => {
      const timeDelta = left.completionTimestamp.getTime() - right.completionTimestamp.getTime();
      if (timeDelta !== 0) {
        return sortOrder === "oldest" ? timeDelta : -timeDelta;
      }

      const idDelta = left.roomId.localeCompare(right.roomId);
      return sortOrder === "oldest" ? idDelta : -idDelta;
    });

    const filtered = sortedRows.filter((row) => {
      if (matchStatusFilter && row.matchStatus !== matchStatusFilter) return false;
      if (roleFilter && row.role !== roleFilter) return false;
      if (typeof isWinnerFilter === "boolean" && row.isWinner !== isWinnerFilter) return false;
      if (search.length > 0 && !row.roomId.toLowerCase().includes(search)) return false;
      return true;
    });

    const cursorStartIndex = useCursorPagination
      ? filtered.findIndex(
          (row) =>
            row.roomId === cursor!.gameId && row.completionTimestamp.toISOString() === cursor!.completionTimestamp,
        ) + 1
      : 0;

    const total = filtered.length;
    const offset = useCursorPagination ? Math.max(0, cursorStartIndex) : (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit);
    const hasMore = offset + pageRows.length < total;
    const nextCursor = hasMore
      ? encodeCursor({
          completionTimestamp: pageRows[pageRows.length - 1]!.completionTimestamp.toISOString(),
          gameId: pageRows[pageRows.length - 1]!.roomId,
        })
      : null;

    const archiveMap = await getArchiveMap(pageRows.map((row) => row.roomId));

    const items = pageRows.map((row) => {
      const archive = archiveMap.get(row.roomId);

      return {
        gameId: row.roomId,
        completionTimestamp: row.completionTimestamp.toISOString(),
        role: row.role,
        isWinner: row.isWinner,
        matchStatus: row.matchStatus,
        roundsSurvived: row.roundsSurvived,
        winnerName: archive?.winnerName ?? null,
        winnerId: archive?.winnerId ?? null,
        participantCount: Array.isArray(archive?.finalParticipants) ? archive.finalParticipants.length : 0,
      };
    });

    res.json({
      items,
      pagination: {
        page: useCursorPagination ? 1 : page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore,
        nextCursor,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /history error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/history/:gameId", requireAuth, async (req: any, res) => {
  try {
    const user = await getDbUser(req.clerkUserId);
    if (!user) {
      sendError(res, 404, "not_found", "User not found");
      return;
    }

    const historyRow = await db.query.playerGameHistoryTable.findFirst({
      where: and(eq(playerGameHistoryTable.userId, user.id), eq(playerGameHistoryTable.roomId, req.params.gameId)),
    });

    if (!historyRow) {
      sendError(res, 404, "not_found", "Game not found");
      return;
    }

    const archive = await db.query.gameArchivesTable.findFirst({
      where: eq(gameArchivesTable.roomId, req.params.gameId),
    });

    if (!archive) {
      sendError(res, 404, "not_found", "Archive not found");
      return;
    }

    res.json({
      gameId: archive.roomId,
      completionTimestamp: archive.completionTimestamp.toISOString(),
      winnerId: archive.winnerId,
      winnerName: archive.winnerName,
      matchStatus: archive.matchStatus,
      eliminationOrder: archive.eliminationOrder,
      participants: archive.finalParticipants,
      questionsAsked: archive.questionsAsked,
      roundDurations: archive.roundDurations,
      analyticsMetadata: archive.analyticsMetadata,
      questionTelemetrySummary: normalizeQuestionTelemetrySummary(archive.analyticsMetadata),
      playerPerspective: {
        role: historyRow.role,
        isWinner: historyRow.isWinner,
        roundsSurvived: historyRow.roundsSurvived,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /history/:gameId error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/history/:gameId/replay", requireAuth, async (req: any, res) => {
  try {
    const user = await getDbUser(req.clerkUserId);
    if (!user) {
      sendError(res, 404, "not_found", "User not found");
      return;
    }

    const historyRow = await db.query.playerGameHistoryTable.findFirst({
      where: and(eq(playerGameHistoryTable.userId, user.id), eq(playerGameHistoryTable.roomId, req.params.gameId)),
    });
    if (!historyRow) {
      sendError(res, 404, "not_found", "Game not found");
      return;
    }

    const archive = await db.query.gameArchivesTable.findFirst({
      where: eq(gameArchivesTable.roomId, req.params.gameId),
    });
    if (!archive) {
      sendError(res, 404, "not_found", "Archive not found");
      return;
    }

    const eliminationEvents = await db.query.gameplayEventsTable.findMany({
      where: and(eq(gameplayEventsTable.roomId, req.params.gameId), eq(gameplayEventsTable.eventType, "suitor_eliminated")),
      orderBy: (table, helpers) => [helpers.asc(table.createdAt)],
    });
    const eliminationByRound = new Map<number, string[]>();
    for (const event of eliminationEvents) {
      const round = typeof event.payload.round === "number" ? event.payload.round : null;
      const participantId = typeof event.payload.participantId === "string" ? event.payload.participantId : null;
      if (!round || !participantId) continue;
      const list = eliminationByRound.get(round) ?? [];
      list.push(participantId);
      eliminationByRound.set(round, list);
    }

    const roundDurations = Array.isArray(archive.roundDurations) ? archive.roundDurations : [];
    const questionsAsked = Array.isArray(archive.questionsAsked) ? archive.questionsAsked : [];
    const rounds = buildReplayRounds({
      roundDurations,
      questionsAsked,
      eliminationByRound,
    });

    res.json({
      gameId: archive.roomId,
      completionTimestamp: archive.completionTimestamp.toISOString(),
      winnerId: archive.winnerId,
      winnerName: archive.winnerName,
      matchStatus: archive.matchStatus,
      rounds,
      eliminationOrder: archive.eliminationOrder,
      participants: archive.finalParticipants,
      playerPerspective: {
        role: historyRow.role,
        isWinner: historyRow.isWinner,
        roundsSurvived: historyRow.roundsSurvived,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /history/:gameId/replay error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/players/:id/stats", requireAuth, async (req: any, res) => {
  try {
    const user = await getDbUser(req.clerkUserId);
    if (!user) {
      sendError(res, 404, "not_found", "User not found");
      return;
    }

    const isSelf = user.id === req.params.id;
    if (!isSelf && !user.isAdmin) {
      sendError(res, 403, "forbidden", "Forbidden");
      return;
    }

    const stats = await getDerivedStatsForUser(req.params.id);
    res.json(stats);
  } catch (err) {
    logger.error({ err }, "GET /players/:id/stats error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/players/:id/achievements", requireAuth, async (req: any, res) => {
  try {
    const user = await getDbUser(req.clerkUserId);
    if (!user) {
      sendError(res, 404, "not_found", "User not found");
      return;
    }

    const isSelf = user.id === req.params.id;
    if (!isSelf && !user.isAdmin) {
      sendError(res, 403, "forbidden", "Forbidden");
      return;
    }

    const stats = await getDerivedStatsForUser(req.params.id);
    const achievements = buildAchievements(stats);

    res.json({ achievements });
  } catch (err) {
    logger.error({ err }, "GET /players/:id/achievements error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/analytics/summary", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const days = toInt(req.query.days, 30, 1, 365);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await db.query.gameplayEventsTable.findMany({
      orderBy: (table, { desc: descFn }) => [descFn(table.createdAt)],
    });

    const filtered = events.filter((event) => event.createdAt >= cutoff);

    const eventsByType: Record<string, number> = {};
    for (const event of filtered) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] ?? 0) + 1;
    }

    const topEventTypes = Object.entries(eventsByType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([eventType, count]) => ({ eventType, count }));

    res.json({
      days,
      totalEvents: filtered.length,
      uniqueRooms: new Set(filtered.map((event) => event.roomId).filter(Boolean)).size,
      uniqueUsers: new Set(filtered.map((event) => event.userId).filter(Boolean)).size,
      eventsByType,
      topEventTypes,
    });
  } catch (err) {
    logger.error({ err }, "GET /analytics/summary error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

router.get("/analytics/events", requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const page = toInt(req.query.page, 1, 1, 10_000);
    const limit = toInt(req.query.limit, 50, 1, 200);
    const eventType = typeof req.query.eventType === "string" ? req.query.eventType : null;

    const allEvents = await db.query.gameplayEventsTable.findMany({
      orderBy: (table, { desc: descFn }) => [descFn(table.createdAt)],
    });

    const filtered = eventType ? allEvents.filter((event) => event.eventType === eventType) : allEvents;
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const hasMore = offset + limit < total;
    const nextCursor = null;
    const items = filtered.slice(offset, offset + limit).map((event) => ({
      id: event.id,
      roomId: event.roomId,
      userId: event.userId,
      participantId: event.participantId,
      eventType: event.eventType,
      payload: event.payload,
      createdAt: event.createdAt.toISOString(),
    }));

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasMore,
        nextCursor,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /analytics/events error");
    sendError(res, 500, "internal_error", "Internal server error");
  }
});

export default router;
