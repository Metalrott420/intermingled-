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

vi.mock("@clerk/express", () => ({ verifyToken: mockVerifyToken }));
vi.mock("../../../services/analyticsService.js", () => ({ trackGameplayEvent: mockTrackGameplayEvent }));
vi.mock("../../../lib/roomUtils.js", () => ({ buildRoomResponse: mockBuildRoomResponse }));
vi.mock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { initSocket } from "../../../socket.js";

const ROOM_ID = "room-recovery-2";
const PARTICIPANT_ID = "participant-recovery-2";
const MATCH_ID = "match-123";

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
    code: "EFGH",
    status: "active",
    roomSnapshotVersion: 100,
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

describe("Recovery integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ sub: "clerk-2" });
    mockUsersWhere.mockResolvedValue([{ id: "db-user-2" }]);
    mockParticipantFindFirst.mockResolvedValue({
      id: PARTICIPANT_ID,
      roomId: ROOM_ID,
      userId: "db-user-2",
      role: "suitor",
      isBot: false,
    });
    mockBuildRoomResponse.mockResolvedValue(nextRoomPayload());
    process.env.CLERK_SECRET_KEY = "test-secret";
  });

  afterEach(() => {
    delete process.env.CLERK_SECRET_KEY;
  });

  it("offline timeout recovery converges to authoritative state for countdown, question, elimination, and winner selection", async () => {
    const offlineSnapshots = [
      nextRoomPayload({ roomSnapshotVersion: 110, currentRound: 1, roundEndsAt: new Date(Date.now() + 500).toISOString() }),
      nextRoomPayload({ roomSnapshotVersion: 112, currentRound: 2, roundEndsAt: null }),
      nextRoomPayload({ roomSnapshotVersion: 115, currentRound: 2, eliminatedParticipants: ["elim-1"] }),
      nextRoomPayload({ roomSnapshotVersion: 119, status: "ended", winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
    ];

    for (const snapshot of offlineSnapshots) {
      mockBuildRoomResponse.mockResolvedValue(snapshot);
      const stack = await createSocketStack();
      const connected: ClientSocket[] = [];
      try {
        const online = await stack.newClient();
        connected.push(online);
        await new Promise<void>((resolve) => {
          online.once("room_updated", () => resolve());
          online.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
        });

        online.disconnect();

        const resumed = await stack.newClient();
        connected.push(resumed);
        const payload = await new Promise<any>((resolve) => {
          resumed.once("room_updated", (room) => resolve(room));
          resumed.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
        });

        expect(payload.roomSnapshotVersion).toBe(snapshot.roomSnapshotVersion);
        expect(payload.status).toBe(snapshot.status);
        expect(payload.currentRound).toBe(snapshot.currentRound);
        expect(payload.eliminatedParticipants).toEqual(snapshot.eliminatedParticipants);
        expect(payload.winnerId).toBe(snapshot.winnerId);
      } finally {
        await stack.shutdown(connected);
      }
    }
  });

  it("long offline reconnect after several transitions lands on latest completed state", async () => {
    const stack = await createSocketStack();
    const connected: ClientSocket[] = [];

    try {
      mockBuildRoomResponse.mockResolvedValue(nextRoomPayload({ roomSnapshotVersion: 130, currentRound: 1 }));
      const first = await stack.newClient();
      connected.push(first);
      await new Promise<void>((resolve) => {
        first.once("room_updated", () => resolve());
        first.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
      });

      first.disconnect();

      mockBuildRoomResponse.mockResolvedValue(
        nextRoomPayload({ roomSnapshotVersion: 144, status: "ended", currentRound: 2, winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
      );

      const reconnected = await stack.newClient();
      connected.push(reconnected);
      const payload = await new Promise<any>((resolve) => {
        reconnected.once("room_updated", (room) => resolve(room));
        reconnected.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
      });

      expect(payload.roomSnapshotVersion).toBe(144);
      expect(payload.status).toBe("ended");
      expect(payload.winnerId).toBe(PARTICIPANT_ID);
    } finally {
      await stack.shutdown(connected);
    }
  });

  it("reconnect after private chat opens still restores canonical gameplay room state", async () => {
    const stack = await createSocketStack();
    const connected: ClientSocket[] = [];

    try {
      const first = await stack.newClient();
      connected.push(first);

      await new Promise<void>((resolve) => {
        first.once("room_updated", () => resolve());
        first.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
      });

      first.emit("join_match", { matchId: MATCH_ID });
      first.disconnect();

      mockBuildRoomResponse.mockResolvedValue(
        nextRoomPayload({ roomSnapshotVersion: 152, status: "ended", winnerId: PARTICIPANT_ID, winnerName: "Suitor" }),
      );

      const resumed = await stack.newClient();
      connected.push(resumed);

      const payload = await new Promise<any>((resolve) => {
        resumed.once("room_updated", (room) => resolve(room));
        resumed.emit("join_room", { roomId: ROOM_ID, participantId: PARTICIPANT_ID, token: "token-b" });
      });

      expect(payload.roomSnapshotVersion).toBe(152);
      expect(payload.status).toBe("ended");
      expect(payload.winnerId).toBe(PARTICIPANT_ID);
    } finally {
      await stack.shutdown(connected);
    }
  });
});
