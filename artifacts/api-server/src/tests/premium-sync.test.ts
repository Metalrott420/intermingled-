/**
 * Integration test: premium badge refresh without rejoin
 *
 * Verifies that POST /api/entitlement/premium/sync:
 *  1. Re-checks the RevenueCat entitlement for the caller
 *  2. Updates all active participant rows that have a stale isPremium flag
 *  3. Emits `room_updated` on each affected room so connected clients see the
 *     premium badge without needing to rejoin
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";

// ---------------------------------------------------------------------------
// Module mocks — vi.mock calls are hoisted before any imports
// ---------------------------------------------------------------------------

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

vi.mock("../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../socket.js", () => ({
  getIo: vi.fn(),
}));

vi.mock("../lib/roomUtils.js", () => ({
  buildRoomResponse: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Deferred imports so mocks are in place when modules are resolved
// ---------------------------------------------------------------------------

import { db } from "@workspace/db";
import { getAuth } from "@clerk/express";
import { getIo } from "../socket.js";
import { buildRoomResponse } from "../lib/roomUtils.js";
import entitlementRouter from "../routes/entitlement.js";

// ---------------------------------------------------------------------------
// Test app — minimal express wrapper around the entitlement router
// ---------------------------------------------------------------------------

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", entitlementRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CLERK_ID = "user_test_clerk_123";
const TEST_DB_USER_ID = "db-user-uuid-1";
const TEST_ROOM_ID = "room-uuid-1";
const TEST_PARTICIPANT_ID = "participant-uuid-suitor-1";

/** RevenueCat response with an active "premium" entitlement */
function makeRevenueCatPremiumResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      subscriber: {
        entitlements: {
          premium: {
            expires_date: null, // lifetime — always active
          },
        },
      },
    }),
  } as unknown as Response;
}

/** Minimal room payload returned by buildRoomResponse after the update */
function makeRoomPayload(isPremium: boolean) {
  return {
    id: TEST_ROOM_ID,
    code: "ABCD",
    status: "active",
    chooserName: "Alice",
    suitorCount: 1,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/entitlement/premium/sync — live badge refresh", () => {
  let mockEmit: ReturnType<typeof vi.fn>;
  let mockTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure the RevenueCat entitlement check doesn't short-circuit before fetch
    process.env.REVENUECAT_SECRET_KEY = "test-revenuecat-secret";

    // Auth: make the route believe the caller is authenticated
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_CLERK_ID } as any);

    // DB: user lookup
    vi.mocked(db.query.usersTable.findFirst).mockResolvedValue({
      id: TEST_DB_USER_ID,
    } as any);

    // DB: participant lookup — suitor currently NOT premium
    vi.mocked(db.query.participantsTable.findMany).mockResolvedValue([
      {
        id: TEST_PARTICIPANT_ID,
        roomId: TEST_ROOM_ID,
        userId: TEST_DB_USER_ID,
        isPremium: false,
      },
    ] as any);

    // DB: update chain resolves cleanly
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    vi.mocked(db.update).mockReturnValue({ set: mockSet } as any);

    // RevenueCat: caller has an active premium entitlement
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeRevenueCatPremiumResponse()));

    // Socket.IO: capture what gets emitted
    mockEmit = vi.fn();
    mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
    vi.mocked(getIo).mockReturnValue({ to: mockTo } as any);

    // roomUtils: return the updated room payload (isPremium: true)
    vi.mocked(buildRoomResponse).mockResolvedValue(makeRoomPayload(true) as any);
  });

  it("returns isPremium:true and roomsUpdated:1", async () => {
    const app = buildTestApp();
    const res = await supertest(app)
      .post("/api/entitlement/premium/sync")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.isPremium).toBe(true);
    expect(res.body.roomsUpdated).toBe(1);
  });

  it("emits room_updated to the affected room", async () => {
    const app = buildTestApp();
    await supertest(app)
      .post("/api/entitlement/premium/sync")
      .set("Content-Type", "application/json");

    expect(mockTo).toHaveBeenCalledWith(TEST_ROOM_ID);
    expect(mockEmit).toHaveBeenCalledWith("room_updated", expect.any(Object));
  });

  it("room_updated payload contains isPremium:true for the suitor", async () => {
    const app = buildTestApp();
    await supertest(app)
      .post("/api/entitlement/premium/sync")
      .set("Content-Type", "application/json");

    const emittedPayload = mockEmit.mock.calls[0]?.[1];
    expect(emittedPayload).toBeDefined();

    const suitor = emittedPayload.participants.find(
      (p: any) => p.id === TEST_PARTICIPANT_ID,
    );
    expect(suitor).toBeDefined();
    expect(suitor.isPremium).toBe(true);
  });

  it("does NOT emit room_updated when participant is already premium", async () => {
    // Participant is already marked premium — no stale rows
    vi.mocked(db.query.participantsTable.findMany).mockResolvedValue([
      {
        id: TEST_PARTICIPANT_ID,
        roomId: TEST_ROOM_ID,
        userId: TEST_DB_USER_ID,
        isPremium: true,
      },
    ] as any);

    const app = buildTestApp();
    const res = await supertest(app)
      .post("/api/entitlement/premium/sync")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.roomsUpdated).toBe(0);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: undefined } as any);

    const app = buildTestApp();
    const res = await supertest(app)
      .post("/api/entitlement/premium/sync")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
