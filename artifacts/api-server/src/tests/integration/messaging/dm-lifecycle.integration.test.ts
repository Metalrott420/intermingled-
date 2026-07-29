import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockUsersFindFirst,
  mockMatchesFindFirst,
  mockReadStateFindFirst,
  mockMessagesFindMany,
  mockInsertValues,
  mockUpdateWhere,
  mockTo,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockUsersFindFirst: vi.fn(),
  mockMatchesFindFirst: vi.fn(),
  mockReadStateFindFirst: vi.fn(),
  mockMessagesFindMany: vi.fn(),
  mockInsertValues: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockTo: vi.fn(() => ({ emit: vi.fn() })),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const db = {
    query: {
      usersTable: { findFirst: mockUsersFindFirst },
      matchesTable: { findFirst: mockMatchesFindFirst },
      matchReadStatesTable: { findFirst: mockReadStateFindFirst },
      directMessagesTable: { findMany: mockMessagesFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: mockUpdateWhere })) })),
  };

  return {
    db,
    usersTable: { id: "id", clerkId: "clerkId" },
    matchesTable: { id: "id", roomId: "roomId", chooserUserId: "chooserUserId", suitorUserId: "suitorUserId" },
    directMessagesTable: { matchId: "matchId", createdAt: "createdAt" },
    matchReadStatesTable: { id: "id", matchId: "matchId", userId: "userId", lastReadAt: "lastReadAt" },
  };
});

vi.mock("../../../socket.js", () => ({
  getIo: () => ({ to: mockTo }),
  getMatchPresenceSnapshot: vi.fn(() => ({
    selfOnline: true,
    otherOnline: false,
    isOtherTyping: false,
    lastTypingAt: null,
  })),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import dmRouter from "../../../routes/dm.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", dmRouter);
  return app;
}

describe("DM lifecycle integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-1" });
    mockUsersFindFirst.mockResolvedValue({ id: "user-1", clerkId: "clerk-1", name: "Ava" });
    mockMatchesFindFirst.mockResolvedValue({
      id: "match-1",
      roomId: "room-1",
      chooserUserId: "user-1",
      suitorUserId: "user-2",
      chooserName: "Ava",
      suitorName: "Blake",
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
    });
    mockReadStateFindFirst.mockResolvedValue({
      id: "rs-1",
      matchId: "match-1",
      userId: "user-1",
      lastReadAt: new Date("2026-07-20T00:00:00.000Z"),
    });
    mockMessagesFindMany.mockResolvedValue([
      {
        id: "m-1",
        matchId: "match-1",
        senderId: "user-2",
        senderName: "Blake",
        content: "hey",
        createdAt: new Date("2026-07-20T01:00:00.000Z"),
      },
    ]);
    mockUpdateWhere.mockResolvedValue([]);
    mockInsertValues.mockResolvedValue([]);
  });

  it("GET /api/matches/:matchId/state returns lifecycle state including unread count and presence", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/matches/match-1/state");

    expect(response.status).toBe(200);
    expect(response.body.matchId).toBe("match-1");
    expect(response.body.unreadCount).toBe(1);
    expect(response.body.presence.selfOnline).toBe(true);
  });

  it("POST /api/matches/:matchId/read updates read cursor", async () => {
    const app = buildApp();
    const response = await supertest(app)
      .post("/api/matches/match-1/read")
      .send({ lastReadAt: "2026-07-20T02:00:00.000Z" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.matchId).toBe("match-1");
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});
