import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockUsersFindFirst,
  mockHistoryFindFirst,
  mockArchivesFindFirst,
  mockEventsFindMany,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockHistoryFindFirst: vi.fn(),
  mockArchivesFindFirst: vi.fn(),
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
      usersTable: { findFirst: mockUsersFindFirst },
      playerGameHistoryTable: { findFirst: mockHistoryFindFirst },
      gameArchivesTable: { findFirst: mockArchivesFindFirst },
      gameplayEventsTable: { findMany: mockEventsFindMany },
    },
  },
  usersTable: { id: "id", clerkId: "clerkId", isAdmin: "isAdmin" },
  playerGameHistoryTable: { userId: "userId", roomId: "roomId" },
  gameArchivesTable: { roomId: "roomId" },
  gameplayEventsTable: { roomId: "roomId", eventType: "eventType", createdAt: "createdAt" },
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

describe("History replay integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuth.mockReturnValue({ userId: "clerk-1" });
    mockUsersFindFirst.mockResolvedValue({ id: "user-1", clerkId: "clerk-1", isAdmin: false });
    mockHistoryFindFirst.mockResolvedValue({
      id: "h-1",
      userId: "user-1",
      roomId: "game-1",
      role: "suitor",
      isWinner: true,
      roundsSurvived: 3,
    });
    mockArchivesFindFirst.mockResolvedValue({
      roomId: "game-1",
      completionTimestamp: new Date("2026-07-18T10:00:00.000Z"),
      winnerId: "p-1",
      winnerName: "Winner",
      matchStatus: "matched",
      eliminationOrder: ["p-2"],
      finalParticipants: [
        { id: "p-1", name: "Winner", role: "suitor", suitorSlot: 1, isBot: false, isPremium: true },
        { id: "p-2", name: "Runner", role: "suitor", suitorSlot: 2, isBot: false, isPremium: false },
      ],
      roundDurations: [30, 30, 30],
      questionsAsked: [
        { participantId: "p-1", suitorSlot: 1, round: 1, content: "Q1", createdAt: "2026-07-18T09:01:00.000Z" },
        { participantId: "p-1", suitorSlot: 1, round: 2, content: "Q2", createdAt: "2026-07-18T09:02:00.000Z" },
      ],
    });
    mockEventsFindMany.mockResolvedValue([
      { eventType: "suitor_eliminated", payload: { participantId: "p-2", round: 2 }, createdAt: new Date("2026-07-18T09:03:00.000Z") },
    ]);
  });

  it("GET /api/history/:gameId/replay returns round timeline replay payload", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/history/game-1/replay");

    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe("game-1");
    expect(response.body.rounds).toHaveLength(3);
    expect(response.body.rounds[0].questions).toHaveLength(1);
    expect(response.body.rounds[1].eliminatedParticipantIds).toEqual(["p-2"]);
    expect(response.body.playerPerspective.isWinner).toBe(true);
  });
});
