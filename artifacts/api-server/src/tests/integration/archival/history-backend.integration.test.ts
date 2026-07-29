import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockUsersFindFirst,
  mockHistoryFindMany,
  mockHistoryFindFirst,
  mockArchivesFindFirst,
  mockStatsFindFirst,
  mockEventsFindMany,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockHistoryFindMany: vi.fn(),
  mockHistoryFindFirst: vi.fn(),
  mockArchivesFindFirst: vi.fn(),
  mockStatsFindFirst: vi.fn(),
  mockEventsFindMany: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      usersTable: {
        findFirst: mockUsersFindFirst,
      },
      playerGameHistoryTable: {
        findMany: mockHistoryFindMany,
        findFirst: mockHistoryFindFirst,
      },
      gameArchivesTable: {
        findFirst: mockArchivesFindFirst,
      },
      playerGameStatsTable: {
        findFirst: mockStatsFindFirst,
      },
      gameplayEventsTable: {
        findMany: mockEventsFindMany,
      },
    },
  },
  usersTable: { id: "id", clerkId: "clerkId", isAdmin: "isAdmin" },
  playerGameHistoryTable: { userId: "userId", roomId: "roomId" },
  gameArchivesTable: { roomId: "roomId" },
  playerGameStatsTable: { userId: "userId" },
  gameplayEventsTable: { createdAt: "createdAt", eventType: "eventType" },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import historyRouter from "../../../routes/history.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", historyRouter);
  return app;
}

describe("History backend integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuth.mockReturnValue({ userId: "clerk-1" });
    mockUsersFindFirst.mockResolvedValue({ id: "user-1", clerkId: "clerk-1", isAdmin: false });

    mockHistoryFindMany.mockResolvedValue([
      {
        id: "h-1",
        userId: "user-1",
        roomId: "game-1",
        role: "suitor",
        isWinner: true,
        matchStatus: "matched",
        roundsSurvived: 3,
        completionTimestamp: new Date("2026-07-18T10:00:00.000Z"),
      },
      {
        id: "h-2",
        userId: "user-1",
        roomId: "game-2",
        role: "suitor",
        isWinner: false,
        matchStatus: "unmatched",
        roundsSurvived: 1,
        completionTimestamp: new Date("2026-07-17T10:00:00.000Z"),
      },
    ]);

    mockHistoryFindFirst.mockResolvedValue({
      id: "h-1",
      userId: "user-1",
      roomId: "game-1",
      role: "suitor",
      isWinner: true,
      matchStatus: "matched",
      roundsSurvived: 3,
      completionTimestamp: new Date("2026-07-18T10:00:00.000Z"),
    });

    mockArchivesFindFirst.mockImplementation(async (args: any) => {
      const roomId = args?.where?.right?.value ?? "game-1";
      if (roomId === "game-2") {
        return {
          id: "a-2",
          roomId: "game-2",
          finalParticipants: [],
          eliminationOrder: [],
          questionsAsked: [],
          roundDurations: [30, 30, 30],
          winnerId: null,
          winnerName: null,
          matchStatus: "unmatched",
          completionTimestamp: new Date("2026-07-17T10:00:00.000Z"),
          analyticsMetadata: {},
        };
      }
      return {
        id: "a-1",
        roomId: "game-1",
        finalParticipants: [
          { id: "p-1", name: "Winner", role: "suitor", suitorSlot: 1, isBot: false, isPremium: true },
        ],
        eliminationOrder: ["p-2"],
        questionsAsked: [
          {
            participantId: "p-1",
            suitorSlot: 1,
            round: 1,
            content: "What are you looking for?",
            createdAt: new Date("2026-07-18T09:00:00.000Z").toISOString(),
          },
        ],
        roundDurations: [30, 30, 30],
        winnerId: "p-1",
        winnerName: "Winner",
        matchStatus: "matched",
        completionTimestamp: new Date("2026-07-18T10:00:00.000Z"),
        analyticsMetadata: {
          averageResponseTimeSeconds: 8.5,
          questionTelemetrySummary: {
            askedCount: 4,
            completedCount: 3,
            skippedCount: 1,
            timeoutCount: 0,
            ratedCount: 0,
            averageResponseTimeSeconds: 8.5,
            averageRating: null,
          },
        },
      };
    });

    mockStatsFindFirst.mockResolvedValue({
      id: "s-1",
      userId: "user-1",
      gamesPlayed: 2,
      wins: 1,
      matches: 1,
      totalRoundsSurvived: 4,
      lastPlayedAt: new Date("2026-07-18T10:00:00.000Z"),
      updatedAt: new Date("2026-07-18T10:00:00.000Z"),
    });

    mockEventsFindMany.mockResolvedValue([
      {
        id: "e-1",
        roomId: "game-1",
        userId: "user-1",
        participantId: "p-1",
        eventType: "room_joined",
        payload: {},
        createdAt: new Date(),
      },
      {
        id: "e-2",
        roomId: "game-1",
        userId: "user-1",
        participantId: "p-1",
        eventType: "game_archived",
        payload: {},
        createdAt: new Date(),
      },
    ]);
  });

  it("GET /api/history returns paginated history for current user", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/history?page=1&limit=1");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].gameId).toBe("game-1");
    expect(response.body.pagination.total).toBe(2);
    expect(response.body.pagination.hasMore).toBe(true);
  });

  it("GET /api/history supports cursor pagination and sort/filter options", async () => {
    const app = buildApp();

    const firstResponse = await supertest(app).get("/api/history?limit=1&sort=newest");
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.items).toHaveLength(1);
    expect(firstResponse.body.items[0].gameId).toBe("game-1");
    expect(firstResponse.body.pagination.nextCursor).toBeTruthy();

    const secondResponse = await supertest(app).get(
      `/api/history?limit=1&sort=newest&cursor=${encodeURIComponent(firstResponse.body.pagination.nextCursor)}`,
    );

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.items).toHaveLength(1);
    expect(secondResponse.body.items[0].gameId).toBe("game-2");
    expect(secondResponse.body.pagination.hasMore).toBe(false);
  });

  it("GET /api/history/:gameId returns archived game detail", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/history/game-1");

    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe("game-1");
    expect(response.body.winnerName).toBe("Winner");
    expect(response.body.questionsAsked).toHaveLength(1);
    expect(response.body.questionTelemetrySummary).toMatchObject({
      askedCount: 4,
      completedCount: 3,
      skippedCount: 1,
      timeoutCount: 0,
      ratedCount: 0,
      averageResponseTimeSeconds: 8.5,
      averageRating: null,
    });
  });

  it("GET /api/players/:id/stats returns derived percentages and streaks", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/players/user-1/stats");

    expect(response.status).toBe(200);
    expect(response.body.gamesPlayed).toBe(2);
    expect(response.body.winPercentage).toBe(50);
    expect(response.body.matchPercentage).toBe(50);
    expect(response.body.averageResponseTimeSeconds).toBe(8.5);
    expect(response.body.streaks.maxWinStreak).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/players/:id/achievements returns derived achievements", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/players/user-1/achievements");

    expect(response.status).toBe(200);
    expect(response.body.achievements.length).toBeGreaterThan(0);
    expect(response.body.achievements.some((achievement: any) => achievement.id === "first_game")).toBe(true);
  });

  it("GET /api/analytics/summary blocks non-admin users", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/analytics/summary");

    expect(response.status).toBe(403);
  });

  it("GET /api/analytics/events returns events for admin users", async () => {
    mockUsersFindFirst.mockResolvedValue({ id: "admin-1", clerkId: "clerk-1", isAdmin: true });

    const app = buildApp();
    const response = await supertest(app).get("/api/analytics/events?page=1&limit=20");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.pagination.total).toBe(2);
  });

  it("end-to-end archival journey is visible across player and analytics surfaces", async () => {
    const app = buildApp();

    const historyResponse = await supertest(app).get("/api/history?page=1&limit=10");
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.items[0].gameId).toBe("game-1");

    const gameId = historyResponse.body.items[0].gameId as string;
    const detailResponse = await supertest(app).get(`/api/history/${gameId}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.matchStatus).toBe("matched");

    const statsResponse = await supertest(app).get("/api/players/user-1/stats");
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body.gamesPlayed).toBeGreaterThan(0);

    const achievementsResponse = await supertest(app).get("/api/players/user-1/achievements");
    expect(achievementsResponse.status).toBe(200);
    expect(
      achievementsResponse.body.achievements.some(
        (achievement: any) => achievement.id === "first_game" && achievement.unlocked === true,
      ),
    ).toBe(true);

    mockUsersFindFirst.mockResolvedValue({ id: "admin-1", clerkId: "clerk-1", isAdmin: true });
    const eventsResponse = await supertest(app).get("/api/analytics/events?eventType=game_archived&page=1&limit=20");
    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.items.some((event: any) => event.eventType === "game_archived")).toBe(true);
  });
});
