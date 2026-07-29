import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Archival integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("archives completed room once and records analytics metadata consistently", async () => {
    const trackGameplayEvent = vi.fn();
    const insertGameArchiveValues = vi.fn();
    const insertHistoryValues = vi.fn();
    const insertStatsValues = vi.fn();

    vi.doMock("@workspace/db", () => {
      const gameArchivesTable = { roomId: "roomId" };
      const roomsTable = { id: "id" };
      const participantsTable = { roomId: "roomId" };
      const messagesTable = { roomId: "roomId" };
      const matchesTable = { roomId: "roomId" };
      const gameplayEventsTable = { roomId: "roomId" };
      const playerGameHistoryTable = { userId: "userId" };
      const playerGameStatsTable = { userId: "userId", id: "id" };

      const db = {
        select: vi.fn(() => ({
          from: vi.fn((table: unknown) => ({
            where: vi.fn(async () => {
              if (table === gameArchivesTable) return [];
              if (table === roomsTable) {
                return [{
                  id: "room-arch-1",
                  code: "ARCH1",
                  createdAt: new Date("2026-07-20T00:00:00.000Z"),
                  numberOfRounds: 3,
                  roundDurationSeconds: 30,
                  answerTimeSeconds: 15,
                  maxSuitors: 3,
                  currentRound: 2,
                  winnerId: "p-winner",
                  winnerName: "Winner",
                  eliminatedParticipants: ["p-loser"],
                }];
              }
              if (table === participantsTable) {
                return [
                  { id: "p-winner", userId: "u-winner", roomId: "room-arch-1", name: "Winner", role: "suitor", suitorSlot: 1, isBot: false, isPremium: true },
                  { id: "p-loser", userId: "u-loser", roomId: "room-arch-1", name: "Loser", role: "suitor", suitorSlot: 2, isBot: false, isPremium: false },
                ];
              }
              if (table === messagesTable) {
                return [
                  { senderRole: "chooser", senderId: "chooser-1", suitorSlot: 1, round: 1, content: "Q1", createdAt: new Date("2026-07-20T00:01:00.000Z") },
                ];
              }
              if (table === matchesTable) {
                return [{ id: "m-1", roomId: "room-arch-1" }];
              }
              if (table === gameplayEventsTable) {
                return [
                  { eventType: "suitor_eliminated", payload: { participantId: "p-loser", round: 2 } },
                  {
                    eventType: "question_asked",
                    payload: {
                      questionMessageId: "q-1",
                      round: 1,
                      suitorSlot: 1,
                      askedAt: new Date("2026-07-20T00:00:00.000Z").toISOString(),
                    },
                  },
                  {
                    eventType: "question_completed",
                    payload: {
                      questionMessageId: "q-1",
                      responseTimeSeconds: 7,
                    },
                  },
                ];
              }
              if (table === playerGameStatsTable) {
                return [];
              }
              return [];
            }),
          })),
        })),
        insert: vi.fn((table: unknown) => {
          if (table === gameArchivesTable) return { values: insertGameArchiveValues };
          if (table === playerGameHistoryTable) return { values: insertHistoryValues };
          if (table === playerGameStatsTable) return { values: insertStatsValues };
          return { values: vi.fn() };
        }),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      };

      return {
        db,
        gameArchivesTable,
        gameplayEventsTable,
        matchesTable,
        messagesTable,
        participantsTable,
        playerGameHistoryTable,
        playerGameStatsTable,
        roomsTable,
      };
    });

    vi.doMock("../../../services/analyticsService.js", () => ({ trackGameplayEvent }));
    vi.doMock("../../../services/gameplayAssertions.js", () => ({ logDuplicateArchive: vi.fn() }));

    const archival = await import("../../../services/gameArchivalService.js");

    await archival.archiveCompletedGame("room-arch-1");

    expect(insertGameArchiveValues).toHaveBeenCalledTimes(1);
    expect(insertGameArchiveValues).toHaveBeenCalledWith(
      expect.objectContaining({
        analyticsMetadata: expect.objectContaining({
          averageResponseTimeSeconds: 7,
          questionTelemetrySummary: expect.objectContaining({
            askedCount: 1,
            completedCount: 1,
            skippedCount: 0,
            timeoutCount: 0,
            ratedCount: 0,
            averageResponseTimeSeconds: 7,
            averageRating: null,
          }),
        }),
      }),
    );
    expect(insertHistoryValues).toHaveBeenCalledTimes(2);
    expect(insertStatsValues).toHaveBeenCalledTimes(2);
    expect(trackGameplayEvent).toHaveBeenCalledWith(
      "game_archived",
      expect.objectContaining({ roomId: "room-arch-1", matchStatus: "matched" }),
      expect.objectContaining({ roomId: "room-arch-1" }),
    );
  });

  it("reconnect after archival resolves to ended authoritative snapshot", async () => {
    const mockParticipantFindFirst = vi.fn();
    const mockUsersWhere = vi.fn();
    const mockBuildRoomResponse = vi.fn();
    const mockVerifyToken = vi.fn();

    vi.doMock("@workspace/db", () => ({
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

    vi.doMock("@clerk/express", () => ({ verifyToken: mockVerifyToken }));
    vi.doMock("../../../services/analyticsService.js", () => ({ trackGameplayEvent: vi.fn() }));
    vi.doMock("../../../lib/roomUtils.js", () => ({ buildRoomResponse: mockBuildRoomResponse }));
    vi.doMock("../../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

    const { createServer } = await import("http");
    const { io: clientIo } = await import("socket.io-client");
    const { initSocket } = await import("../../../socket.js");

    mockVerifyToken.mockResolvedValue({ sub: "clerk-arch" });
    mockUsersWhere.mockResolvedValue([{ id: "db-user-arch" }]);
    mockParticipantFindFirst.mockResolvedValue({ id: "p-arch", roomId: "room-arch-2", userId: "db-user-arch", role: "suitor", isBot: false });
    mockBuildRoomResponse.mockResolvedValue({
      id: "room-arch-2",
      code: "ARCH2",
      status: "ended",
      roomSnapshotVersion: 220,
      chooserName: "Chooser",
      suitorCount: 3,
      maxSuitors: 3,
      numberOfRounds: 3,
      roundDurationSeconds: 30,
      answerTimeSeconds: 15,
      roundEndsAt: null,
      currentRound: 2,
      eliminatedParticipants: ["p-loser"],
      winnerId: "p-arch",
      winnerName: "Winner",
      participants: [],
      createdAt: new Date().toISOString(),
    });

    const httpServer = createServer();
    const io = initSocket(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("bind failure");

    const socket = clientIo(`http://127.0.0.1:${address.port}`, {
      path: "/ws/socket.io",
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("connect_error", reject);
    });

    const payload = await new Promise<any>((resolve) => {
      socket.once("room_updated", (room) => resolve(room));
      socket.emit("join_room", { roomId: "room-arch-2", participantId: "p-arch", token: "token-arch" });
    });

    expect(payload.status).toBe("ended");
    expect(payload.roomSnapshotVersion).toBe(220);
    expect(payload.winnerId).toBe("p-arch");

    socket.disconnect();
    await new Promise<void>((resolve) => {
      try { io.close(() => resolve()); } catch { resolve(); }
    });
    await new Promise<void>((resolve) => {
      try { httpServer.close(() => resolve()); } catch { resolve(); }
    });
  });
});
