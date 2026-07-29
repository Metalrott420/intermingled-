/**
 * Integration test: premium badge refresh without rejoin
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

vi.mock("@workspace/db", () => {
  const mockWhere = vi.fn().mockResolvedValue([]);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  const mockDb = {
    query: {
      usersTable: { findFirst: vi.fn() },
      participantsTable: { findMany: vi.fn() },
    },
    update: mockUpdate,
  };

  return {
    db: mockDb,
    usersTable: { id: "id", clerkId: "clerkId", isPremium: "isPremium" },
    participantsTable: {
      userId: "userId",
      roomId: "roomId",
      isPremium: "isPremium",
    },
  };
});

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(),
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../socket.js", () => ({
  getIo: vi.fn(),
}));

vi.mock("../../../lib/roomUtils.js", () => ({
  buildRoomResponse: vi.fn(),
}));

import { db } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { getIo } from "../../../socket.js";
import { buildRoomResponse } from "../../../lib/roomUtils.js";
import entitlementRouter from "../../../routes/entitlement.js";

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", entitlementRouter);
  return app;
}

const TEST_CLERK_ID = "user_test_clerk_123";
const TEST_DB_USER_ID = "db-user-uuid-1";
const TEST_ROOM_ID = "room-uuid-1";
const TEST_PARTICIPANT_ID = "participant-uuid-suitor-1";

function makeRevenueCatPremiumResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      subscriber: {
        entitlements: {
          premium: {
            expires_date: null,
          },
        },
      },
    }),
  } as unknown as Response;
}

function makeRoomPayload(isPremium: boolean) {
  return {
    id: TEST_ROOM_ID,
    code: "ABCD",
    status: "active",
    suitorCount: 1,
    roomSnapshotVersion: 1,
    chooserName: "Alice",
    maxSuitors: 3,
    currentRound: 1,
    eliminatedParticipants: [],
    winnerId: null,
    winnerName: null,
    participants: [
      {
        id: TEST_PARTICIPANT_ID,
        name: "Bob",
        role: "suitor",
        suitorSlot: 1,
        isBot: false,
        isPremium,
      },
    ],
    createdAt: new Date().toISOString(),
  };
}

describe("Messaging integration: entitlement premium endpoints", () => {
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVENUECAT_SECRET_KEY = "test-revenuecat-secret";
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_CLERK_ID } as any);
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue({ id: TEST_DB_USER_ID } as any);
    vi.mocked(db.query.participantsTable.findMany).mockResolvedValue([
      { id: TEST_PARTICIPANT_ID, roomId: TEST_ROOM_ID, userId: TEST_DB_USER_ID, isPremium: false },
    ] as any);

    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRevenueCatPremiumResponse()));

    mockEmit = vi.fn();
    mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    vi.mocked(getIo).mockReturnValue({ to: mockTo } as any);

    vi.mocked(buildRoomResponse).mockResolvedValue(makeRoomPayload(true) as any);
  });

  it("returns isPremium:true and roomsUpdated:1", async () => {
    const app = buildTestApp();
    const res = await supertest(app).post("/api/entitlement/premium/sync").set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(true);
    expect(res.body.roomsUpdated).toBe(1);
  });

  it("GET /api/entitlement/premium returns current premium status", async () => {
    const app = buildTestApp();
    const res = await supertest(app).get("/api/entitlement/premium");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ isPremium: true });
  });

  it("emits room_updated to the affected room", async () => {
    const app = buildTestApp();
    await supertest(app).post("/api/entitlement/premium/sync").set("Content-Type", "application/json");

    expect(mockTo).toHaveBeenCalledWith(TEST_ROOM_ID);
    expect(mockEmit).toHaveBeenCalledWith("room_updated", expect.any(Object));
  });

  it("does NOT emit room_updated when participant is already premium", async () => {
    vi.mocked(db.query.participantsTable.findMany).mockResolvedValue([
      { id: TEST_PARTICIPANT_ID, roomId: TEST_ROOM_ID, userId: TEST_DB_USER_ID, isPremium: true },
    ] as any);

    const app = buildTestApp();
    const res = await supertest(app).post("/api/entitlement/premium/sync").set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.roomsUpdated).toBe(0);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("GET /api/entitlement/premium returns 401 when unauthenticated", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);
    const app = buildTestApp();
    const res = await supertest(app).get("/api/entitlement/premium");

    expect(res.status).toBe(401);
  });
});
