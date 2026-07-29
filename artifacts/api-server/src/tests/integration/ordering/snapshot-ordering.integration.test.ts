import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Ordering integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GAMEPLAY_STRICT_ASSERTIONS = "true";
  });

  afterEach(() => {
    delete process.env.GAMEPLAY_STRICT_ASSERTIONS;
  });

  it("rejects stale and out-of-order lifecycle emissions by roomSnapshotVersion", async () => {
    const mockEmit = vi.fn();
    const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });

    let roomVersion = 8;

    vi.doMock("@workspace/db", () => {
      const roomsTable = { id: "id", roomSnapshotVersion: "roomSnapshotVersion" };
      return {
        db: {
          query: {
            roomsTable: {
              findFirst: vi.fn(async () => ({ id: "room-1", roomSnapshotVersion: roomVersion })),
            },
          },
        },
        roomsTable,
        messagesTable: {},
        participantsTable: {},
      };
    });

    vi.doMock("../../../socket.js", () => ({ getIo: vi.fn(() => ({ to: mockTo })) }));
    vi.doMock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    vi.doMock("@anthropic-ai/sdk", () => ({ default: class MockAnthropic {} }));

    const messaging = await import("../../../services/messagingService.js");

    await messaging.emitRoomUpdated("room-1", {
      id: "room-1",
      code: "ABCD",
      status: "active",
      roomSnapshotVersion: 8,
      chooserName: "Chooser",
      suitorCount: 3,
      maxSuitors: 3,
      numberOfRounds: 3,
      roundDurationSeconds: 30,
      answerTimeSeconds: 15,
      roundEndsAt: new Date().toISOString(),
      currentRound: 1,
      eliminatedParticipants: [],
      winnerId: null,
      winnerName: null,
      participants: [],
      createdAt: new Date().toISOString(),
    });

    roomVersion = 7;

    await expect(messaging.emitTimerSync("room-1", new Date())).rejects.toThrow(/Snapshot version regressed/i);

    expect(mockEmit).toHaveBeenCalledWith("room_updated", expect.objectContaining({ roomSnapshotVersion: 8 }));
  });

  it("treats delayed timer events as stale when snapshot version regresses", async () => {
    const mockTo = vi.fn().mockReturnValue({ emit: vi.fn() });

    let roomVersion = 11;

    vi.doMock("@workspace/db", () => {
      const roomsTable = { id: "id", roomSnapshotVersion: "roomSnapshotVersion" };
      return {
        db: {
          query: {
            roomsTable: {
              findFirst: vi.fn(async () => ({ id: "room-2", roomSnapshotVersion: roomVersion })),
            },
          },
        },
        roomsTable,
        messagesTable: {},
        participantsTable: {},
      };
    });

    vi.doMock("../../../socket.js", () => ({ getIo: vi.fn(() => ({ to: mockTo })) }));
    vi.doMock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    vi.doMock("@anthropic-ai/sdk", () => ({ default: class MockAnthropic {} }));

    const messaging = await import("../../../services/messagingService.js");

    await messaging.emitTimerSync("room-2", new Date());

    roomVersion = 10;

    await expect(messaging.emitTimerSync("room-2", new Date())).rejects.toThrow(/Snapshot version regressed/i);
  });

  it("rejects out-of-order round, elimination, and terminal lifecycle emissions", async () => {
    const mockTo = vi.fn().mockReturnValue({ emit: vi.fn() });

    let roomVersion = 20;

    vi.doMock("@workspace/db", () => {
      const roomsTable = { id: "id", roomSnapshotVersion: "roomSnapshotVersion" };
      return {
        db: {
          query: {
            roomsTable: {
              findFirst: vi.fn(async () => ({ id: "room-3", roomSnapshotVersion: roomVersion })),
            },
          },
        },
        roomsTable,
        messagesTable: {},
        participantsTable: {},
      };
    });

    vi.doMock("../../../socket.js", () => ({ getIo: vi.fn(() => ({ to: mockTo })) }));
    vi.doMock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
    vi.doMock("@anthropic-ai/sdk", () => ({ default: class MockAnthropic {} }));

    const messaging = await import("../../../services/messagingService.js");

    await messaging.emitRoundStarted("room-3", 2, new Date());
    await messaging.emitRoundAdvanced("room-3", 2, 20);
    await messaging.emitSuitorEliminated("room-3", "p-1", 20);
    await messaging.emitSessionEnded("room-3", { winnerId: "p-1", winnerName: "Winner", roomSnapshotVersion: 20 });

    roomVersion = 19;

    await expect(messaging.emitRoundStarted("room-3", 2, new Date())).rejects.toThrow(/Snapshot version regressed/i);
    await expect(messaging.emitRoundAdvanced("room-3", 2, 19)).rejects.toThrow(/Snapshot version regressed/i);
    await expect(messaging.emitSuitorEliminated("room-3", "p-1", 19)).rejects.toThrow(/Snapshot version regressed/i);
    await expect(messaging.emitSessionEnded("room-3", { winnerId: "p-1", winnerName: "Winner", roomSnapshotVersion: 19 })).rejects.toThrow(/Snapshot version regressed/i);
  });
});
