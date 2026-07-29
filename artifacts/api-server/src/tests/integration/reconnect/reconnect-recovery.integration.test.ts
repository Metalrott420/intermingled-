import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "http";
import { io as clientIo, type Socket as ClientSocket } from "socket.io-client";

const {
  mockParticipantFindFirst,
  mockUsersWhere,
  mockTrackGameplayEvent,
  mockBuildRoomResponse,
  mockVerifyToken,
} = vi.hoisted(() => ({
  mockParticipantFindFirst: vi.fn(),
  mockUsersWhere: vi.fn(),
  mockTrackGameplayEvent: vi.fn(),
  mockBuildRoomResponse: vi.fn(),
  mockVerifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      participantsTable: {
        findFirst: mockParticipantFindFirst,
      },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockUsersWhere,
      })),
    })),
  },
  participantsTable: { id: "id", roomId: "roomId" },
  usersTable: { id: "id", clerkId: "clerkId" },
}));

vi.mock("@clerk/express", () => ({
  verifyToken: mockVerifyToken,
}));

vi.mock("../../../services/analyticsService.js", () => ({
  trackGameplayEvent: mockTrackGameplayEvent,
}));

vi.mock("../../../lib/roomUtils.js", () => ({
  buildRoomResponse: mockBuildRoomResponse,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { initSocket } from "../../../socket.js";

const ROOM_ID = "room-recovery-1";
const PARTICIPANT_ID = "participant-recovery-1";

async function createSocketStack() {
  const httpServer = createServer();
  const io = initSocket(httpServer);

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Failed to bind test server");
  const origin = `http://127.0.0.1:${address.port}`;

  async function newClient() {
    const socket = clientIo(origin, {
      path: "/ws/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    return socket;
  }

  async function shutdown(clientSockets: ClientSocket[]) {
    for (const socket of clientSockets) {
      if (socket.connected) socket.disconnect();
    }
    await new Promise<void>((resolve) => {
      try { io.close(() => resolve()); } catch { resolve(); }
    });
    await new Promise<void>((resolve) => {
      try { httpServer.close(() => resolve()); } catch { resolve(); }
    });
  }

  return { newClient, shutdown };
}

function nextRoomPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: ROOM_ID,
    code: "ABCD",
    status: "active",
    roomSnapshotVersion: 10,
    chooserName: "Chooser",
    suitorCount: 3,
    maxSuitors: 3,
    numberOfRounds: 3,
    roundDurationSeconds: 30,
    answerTimeSeconds: 15,
    roundEndsAt: new Date(Date.now() + 10_000).toISOString(),
    currentRound: 1,
    eliminatedParticipants: [],
    winnerId: null,
    winnerName: null,
    participants: [{ id: PARTICIPANT_ID, name: "Suitor", role: "suitor", suitorSlot: 1, isBot: false, isPremium: false }],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Reconnect integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ sub: "clerk-1" });
    mockUsersWhere.mockResolvedValue([{ id: "db-user-1" }]);
    mockParticipantFindFirst.mockResolvedValue({ id: PARTICIPANT_ID, roomId: ROOM_ID, userId: "db-user-1", role: "suitor", isBot: false });
    mockBuildRoomResponse.mockResolvedValue(nextRoomPayload());
  });

  afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("duplicate joins on the same socket remain idempotent", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";
    const stack = await createSocketStack();
    const connected: ClientSocket[] = [];

    try {
      const client = await stack.newClient();
      connected.push(client);

      const received: any[] = [];
      client.on("room_updated", (payload) => {
        received.push(payload);
      });

      client.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
      client.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });

      await new Promise((resolve) => setTimeout(resolve, 120));

      expect(received.length).toBeGreaterThanOrEqual(2);
      expect(received[0].roomSnapshotVersion).toBe(received[1].roomSnapshotVersion);
      expect(client.connected).toBe(true);
    } finally {
      await stack.shutdown(connected);
    }
  });

  it("duplicate sockets evict stale participant socket and keep latest connected", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";
    const stack = await createSocketStack();
    const connected: ClientSocket[] = [];

    try {
      const firstClient = await stack.newClient();
      connected.push(firstClient);
      await new Promise<void>((resolve) => {
        firstClient.once("room_updated", () => resolve());
        firstClient.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
      });

      const firstDisconnected = new Promise<string>((resolve) => {
        firstClient.once("disconnect", (reason) => resolve(reason));
      });

      const secondClient = await stack.newClient();
      connected.push(secondClient);
      await new Promise<void>((resolve) => {
        secondClient.once("room_updated", () => resolve());
        secondClient.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
      });

      const reason = await firstDisconnected;
      expect(reason).toBe("io server disconnect");
      expect(secondClient.connected).toBe(true);
    } finally {
      await stack.shutdown(connected);
    }
  });

  it("browser refresh restores authoritative state after countdown, question, elimination, winner reveal, and match creation", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";

    const snapshots = [
      nextRoomPayload({ roomSnapshotVersion: 21, currentRound: 1 }),
      nextRoomPayload({ roomSnapshotVersion: 24, currentRound: 2 }),
      nextRoomPayload({ roomSnapshotVersion: 27, currentRound: 2, eliminatedParticipants: ["elim-1"] }),
      nextRoomPayload({ roomSnapshotVersion: 29, status: "ended", winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
      nextRoomPayload({ roomSnapshotVersion: 31, status: "ended", winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
    ];

    for (const snapshot of snapshots) {
      mockBuildRoomResponse.mockResolvedValue(snapshot);
      const stack = await createSocketStack();
      const connected: ClientSocket[] = [];
      try {
        const first = await stack.newClient();
        connected.push(first);
        await new Promise<void>((resolve) => {
          first.once("room_updated", () => resolve());
          first.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
        });

        first.disconnect();

        const refreshed = await stack.newClient();
        connected.push(refreshed);

        const payload = await new Promise<any>((resolve) => {
          refreshed.once("room_updated", (room) => resolve(room));
          refreshed.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
        });

        expect(payload.roomSnapshotVersion).toBe(snapshot.roomSnapshotVersion);
        expect(payload.status).toBe(snapshot.status);
        expect(payload.currentRound).toBe(snapshot.currentRound);
        expect(payload.eliminatedParticipants).toEqual(snapshot.eliminatedParticipants);
      } finally {
        await stack.shutdown(connected);
      }
    }
  });

  it("multiple tabs converge to identical latest snapshot and stale tab cannot overwrite it", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";

    const stack = await createSocketStack();
    const connected: ClientSocket[] = [];

    try {
      mockBuildRoomResponse
        .mockResolvedValueOnce(nextRoomPayload({ roomSnapshotVersion: 60, currentRound: 1 }))
        .mockResolvedValueOnce(nextRoomPayload({ roomSnapshotVersion: 61, currentRound: 2 }))
        .mockResolvedValue(nextRoomPayload({ roomSnapshotVersion: 61, currentRound: 2 }));

      const tabA = await stack.newClient();
      connected.push(tabA);
      const tabB = await stack.newClient();
      connected.push(tabB);

      const a = new Promise<any>((resolve) => {
        tabA.once("room_updated", resolve);
        tabA.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
      });
      const b = new Promise<any>((resolve) => {
        tabB.once("room_updated", resolve);
        tabB.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
      });

      const [payloadA, payloadB] = await Promise.all([a, b]);

      expect(payloadA.roomSnapshotVersion).toBeLessThanOrEqual(payloadB.roomSnapshotVersion);

      const staleTab = payloadA.roomSnapshotVersion < payloadB.roomSnapshotVersion ? payloadA : payloadB;
      const freshTab = payloadA.roomSnapshotVersion < payloadB.roomSnapshotVersion ? payloadB : payloadA;

      expect(staleTab.roomSnapshotVersion).toBeLessThanOrEqual(freshTab.roomSnapshotVersion);
      expect(freshTab.roomSnapshotVersion).toBe(61);
      expect(freshTab.currentRound).toBe(2);
    } finally {
      await stack.shutdown(connected);
    }
  });

  it("temporary disconnect reconverges to canonical snapshot across lobby, countdown, question, answering, elimination, round transition, winner, match, and completed states", async () => {
    process.env.CLERK_SECRET_KEY = "test-secret";

    const phaseSnapshots = [
      nextRoomPayload({ status: "waiting", roomSnapshotVersion: 70, currentRound: 1 }),
      nextRoomPayload({ status: "active", roomSnapshotVersion: 71, currentRound: 1, roundEndsAt: new Date(Date.now() + 7_000).toISOString() }),
      nextRoomPayload({ status: "active", roomSnapshotVersion: 72, currentRound: 1, roundEndsAt: null }),
      nextRoomPayload({ status: "active", roomSnapshotVersion: 73, currentRound: 1, roundEndsAt: new Date(Date.now() + 4_000).toISOString() }),
      nextRoomPayload({ status: "active", roomSnapshotVersion: 74, currentRound: 1, eliminatedParticipants: ["elim-a"] }),
      nextRoomPayload({ status: "active", roomSnapshotVersion: 75, currentRound: 2, eliminatedParticipants: ["elim-a"] }),
      nextRoomPayload({ status: "ended", roomSnapshotVersion: 76, currentRound: 2, winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
      nextRoomPayload({ status: "ended", roomSnapshotVersion: 77, currentRound: 2, winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
      nextRoomPayload({ status: "ended", roomSnapshotVersion: 78, currentRound: 2, winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
    ];

    for (const snapshot of phaseSnapshots) {
      mockBuildRoomResponse.mockResolvedValue(snapshot);
      const stack = await createSocketStack();
      const connected: ClientSocket[] = [];

      try {
        const activeClient = await stack.newClient();
        connected.push(activeClient);

        await new Promise<void>((resolve) => {
          activeClient.once("room_updated", () => resolve());
          activeClient.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
        });

        activeClient.disconnect();

        const resumedClient = await stack.newClient();
        connected.push(resumedClient);

        const restored = await new Promise<any>((resolve) => {
          resumedClient.once("room_updated", (payload) => resolve(payload));
          resumedClient.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-a" });
        });

        expect(restored.roomSnapshotVersion).toBe(snapshot.roomSnapshotVersion);
        expect(restored.status).toBe(snapshot.status);
        expect(restored.currentRound).toBe(snapshot.currentRound);
        expect(restored.eliminatedParticipants).toEqual(snapshot.eliminatedParticipants);
        expect(restored.winnerId).toBe(snapshot.winnerId);
      } finally {
        await stack.shutdown(connected);
      }
    }
  });
});
