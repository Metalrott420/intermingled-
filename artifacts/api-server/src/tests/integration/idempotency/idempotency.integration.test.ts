import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Idempotency integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("skips duplicate archival and records idempotency log", async () => {
    const logDuplicateArchive = vi.fn();

    vi.doMock("@workspace/db", () => {
      const gameArchivesTable = { roomId: "roomId" };
      const roomsTable = { id: "id" };

      const db = {
        select: vi.fn(() => ({
          from: vi.fn((table: unknown) => ({
            where: vi.fn(async () => {
              if (table === gameArchivesTable) return [{ id: "archive-1", roomId: "room-1" }];
              if (table === roomsTable) return [{ id: "room-1" }];
              return [];
            }),
          })),
        })),
      };

      return {
        db,
        gameArchivesTable,
        gameplayEventsTable: {},
        matchesTable: {},
        messagesTable: {},
        participantsTable: {},
        playerGameHistoryTable: {},
        playerGameStatsTable: {},
        roomsTable,
      };
    });

    vi.doMock("../../../services/gameplayAssertions.js", () => ({ logDuplicateArchive }));
    vi.doMock("../../../services/analyticsService.js", () => ({ trackGameplayEvent: vi.fn() }));

    const archival = await import("../../../services/gameArchivalService.js");

    await archival.archiveCompletedGame("room-1");

    expect(logDuplicateArchive).toHaveBeenCalledWith("room-1");
  });

  it("skips duplicate match creation when winner already has an existing match", async () => {
    const logDuplicateMatch = vi.fn();
    const assertRoomTransition = vi.fn();
    const assertWinnerImmutable = vi.fn();
    const mockInsertValues = vi.fn();

    vi.doMock("@workspace/db", () => {
      const roomsTable = { id: "id", roomSnapshotVersion: "roomSnapshotVersion" };
      const participantsTable = { roomId: "roomId", id: "id", role: "role" };
      const matchesTable = { chooserUserId: "chooserUserId", suitorUserId: "suitorUserId" };

      let participantFindFirstCall = 0;

      const db = {
        query: {
          roomsTable: {
            findFirst: vi.fn(async () => ({
              id: "room-1",
              status: "active",
              maxSuitors: 3,
              currentRound: 2,
              winnerId: null,
              roomSnapshotVersion: 2,
            })),
          },
          participantsTable: {
            findFirst: vi.fn(async () => {
              participantFindFirstCall += 1;
              if (participantFindFirstCall === 1) {
                return { id: "winner-1", roomId: "room-1", userId: "suitor-user-1", name: "Winner", isBot: false, role: "suitor" };
              }
              return { id: "chooser-1", roomId: "room-1", userId: "chooser-user-1", name: "Chooser", role: "chooser" };
            }),
          },
          matchesTable: {
            findFirst: vi.fn(async () => ({ id: "match-existing-1", chooserUserId: "chooser-user-1", suitorUserId: "suitor-user-1" })),
          },
        },
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
        insert: vi.fn(() => ({ values: mockInsertValues })),
      };

      return { db, roomsTable, participantsTable, matchesTable };
    });

    vi.doMock("../../../lib/roomUtils.js", () => ({
      buildRoomResponse: vi.fn(async () => ({
        id: "room-1",
        code: "ABCD",
        status: "ended",
        roomSnapshotVersion: 3,
        chooserName: "Chooser",
        suitorCount: 3,
        maxSuitors: 3,
        numberOfRounds: 3,
        roundDurationSeconds: 30,
        answerTimeSeconds: 15,
        roundEndsAt: null,
        currentRound: 2,
        eliminatedParticipants: [],
        winnerId: "winner-1",
        winnerName: "Winner",
        participants: [],
        createdAt: new Date().toISOString(),
      })),
    }));

    vi.doMock("../../../services/messagingService.js", () => ({
      emitRoomUpdated: vi.fn(),
      emitSuitorEliminated: vi.fn(),
      emitRoundAdvanced: vi.fn(),
      emitSessionEnded: vi.fn(),
      emitRoundStarted: vi.fn(),
      emitTimerSync: vi.fn(),
    }));

    vi.doMock("../../../services/gameArchivalService.js", () => ({ archiveCompletedGame: vi.fn() }));
    vi.doMock("../../../services/analyticsService.js", () => ({ trackGameplayEvent: vi.fn() }));
    vi.doMock("../../../services/gameplayAssertions.js", () => ({ assertRoomTransition, assertWinnerImmutable, logDuplicateMatch }));
    vi.doMock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

    const flow = await import("../../../services/gameFlowService.js");
    await flow.chooseWinner("room-1", "winner-1");

    expect(logDuplicateMatch).toHaveBeenCalledWith("room-1", "chooser-user-1", "suitor-user-1");
    expect(mockInsertValues).not.toHaveBeenCalled();
    expect(assertWinnerImmutable).toHaveBeenCalled();
  });
});
