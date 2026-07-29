import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockRoomFindFirst,
  mockQuestionFindFirst,
  mockUserFindFirst,
  mockParticipantFindFirst,
  mockRecordQuestionRated,
  mockGetQuestionRatingSnapshots,
  mockGetQuestionPerformanceSnapshots,
  mockQuestionRows,
  mockQuestionEvents,
  mockArchives,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockRoomFindFirst: vi.fn(),
  mockQuestionFindFirst: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockParticipantFindFirst: vi.fn(),
  mockRecordQuestionRated: vi.fn(),
  mockGetQuestionRatingSnapshots: vi.fn(),
  mockGetQuestionPerformanceSnapshots: vi.fn(),
  mockQuestionRows: vi.fn(),
  mockQuestionEvents: vi.fn(),
  mockArchives: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
}));

vi.mock("@workspace/db", () => {
  const roomsTable = { id: "id", roomSnapshotVersion: "roomSnapshotVersion" };
  const questionBankTable = { id: "id", isActive: "isActive", updatedAt: "updatedAt", usageCount: "usageCount" };
  const gameArchivesTable = { questionsAsked: "questionsAsked", completionTimestamp: "completionTimestamp" };
  const usersTable = { id: "id", clerkId: "clerkId", isAdmin: "isAdmin" };
  const participantsTable = { id: "id", roomId: "roomId" };
  const gameplayEventsTable = { roomId: "roomId", eventType: "eventType", createdAt: "createdAt" };

  return {
    db: {
      query: {
        roomsTable: {
          findFirst: mockRoomFindFirst,
        },
        questionBankTable: {
          findFirst: mockQuestionFindFirst,
        },
        usersTable: {
          findFirst: mockUserFindFirst,
        },
        participantsTable: {
          findFirst: mockParticipantFindFirst,
        },
        gameplayEventsTable: {
          findMany: mockQuestionEvents,
        },
      },
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === questionBankTable) {
            return {
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => mockQuestionRows()),
              })),
            };
          }
          if (table === gameArchivesTable) {
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => mockArchives()),
              })),
            };
          }
          return {
            where: vi.fn(() => ({ orderBy: vi.fn(async () => []) })),
          };
        }),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) })),
      insert: vi.fn(() => ({ values: vi.fn(async () => []) })),
    },
    roomsTable,
    questionBankTable,
    gameArchivesTable,
    usersTable,
    participantsTable,
    gameplayEventsTable,
  };
});

vi.mock("../../../services/questionTelemetryService.js", () => ({
  recordQuestionRated: mockRecordQuestionRated,
  getQuestionRatingSnapshots: mockGetQuestionRatingSnapshots,
  getQuestionPerformanceSnapshots: mockGetQuestionPerformanceSnapshots,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import roomsRouter from "../../../routes/rooms.js";
import { selectRoundQuestionsForRoom } from "../../../services/questionService.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", roomsRouter);
  return app;
}

function makeQuestionRows() {
  return [
    {
      id: "q-high",
      packSlug: "core",
      category: "general",
      difficulty: "easy",
      content: "Question with stronger feedback",
      normalizedHash: "hash-high",
      isActive: true,
      usageCount: 1,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    },
    {
      id: "q-low",
      packSlug: "core",
      category: "general",
      difficulty: "easy",
      content: "Question with weaker feedback",
      normalizedHash: "hash-low",
      isActive: true,
      usageCount: 1,
      createdAt: new Date("2026-07-20T00:00:00.000Z"),
      updatedAt: new Date("2026-07-20T00:00:00.000Z"),
    },
  ];
}

describe("Question ratings integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-user-1" });
    mockUserFindFirst.mockResolvedValue({ id: "user-1", clerkId: "clerk-user-1", isAdmin: false });
    mockRoomFindFirst.mockResolvedValue({
      id: "room-1",
      status: "active",
      currentRound: 2,
      maxSuitors: 3,
      roomSnapshotVersion: 12,
      currentRoundQuestionIds: ["q-high"],
      usedQuestionIds: ["q-high"],
      questionConfig: {},
    });
    mockQuestionFindFirst.mockImplementation(async () => ({
      id: "q-high",
      content: "Question with stronger feedback",
      packSlug: "core",
      category: "general",
      difficulty: "easy",
    }));
    mockParticipantFindFirst.mockResolvedValue({
      id: "participant-1",
      roomId: "room-1",
      userId: "user-1",
      role: "chooser",
      isBot: false,
    });
    mockQuestionRows.mockReturnValue(makeQuestionRows());
    mockQuestionEvents.mockResolvedValue([
      {
        id: "e-1",
        roomId: "room-1",
        userId: "user-1",
        participantId: "participant-1",
        eventType: "question_rated",
        payload: { questionId: "q-high", rating: 5 },
        createdAt: new Date("2026-07-20T00:10:00.000Z"),
      },
      {
        id: "e-2",
        roomId: "room-1",
        userId: "user-1",
        participantId: "participant-1",
        eventType: "question_rated",
        payload: { questionId: "q-high", rating: 4 },
        createdAt: new Date("2026-07-20T00:11:00.000Z"),
      },
      {
        id: "e-3",
        roomId: "room-1",
        userId: "user-1",
        participantId: "participant-1",
        eventType: "question_rated",
        payload: { questionId: "q-low", rating: 1 },
        createdAt: new Date("2026-07-20T00:12:00.000Z"),
      },
    ]);
    mockGetQuestionRatingSnapshots.mockResolvedValue(
      new Map([
        ["q-high", { questionId: "q-high", ratingCount: 2, averageRating: 4.5, qualityScore: 90 }],
        ["q-low", { questionId: "q-low", ratingCount: 1, averageRating: 1, qualityScore: 20 }],
      ]),
    );
    mockGetQuestionPerformanceSnapshots.mockResolvedValue(
      new Map([
        [
          "q-high",
          {
            questionId: "q-high",
            content: "Question with stronger feedback",
            packSlug: "core",
            category: "general",
            difficulty: "easy",
            usageCount: 1,
            exposureCount: 3,
            recentExposureCount: 0,
            ratingCount: 2,
            averageRating: 4.5,
            completedCount: 2,
            completionRate: 0.67,
            skippedCount: 0,
            skipRate: 0,
            timeoutCount: 0,
            timeoutRate: 0,
            averageResponseTimeSeconds: 7,
            confidenceScore: 80,
            freshnessScore: 92,
            qualityScore: 90,
            suggestedArchive: false,
            suggestedPromote: true,
          },
        ],
        [
          "q-low",
          {
            questionId: "q-low",
            content: "Question with weaker feedback",
            packSlug: "core",
            category: "general",
            difficulty: "easy",
            usageCount: 1,
            exposureCount: 3,
            recentExposureCount: 0,
            ratingCount: 1,
            averageRating: 1,
            completedCount: 0,
            completionRate: 0,
            skippedCount: 2,
            skipRate: 0.67,
            timeoutCount: 1,
            timeoutRate: 0.33,
            averageResponseTimeSeconds: null,
            confidenceScore: 60,
            freshnessScore: 92,
            qualityScore: 20,
            suggestedArchive: true,
            suggestedPromote: false,
          },
        ],
      ]),
    );
    mockArchives.mockResolvedValue([]);
  });

  it("records live question ratings through the room endpoint", async () => {
    const app = buildApp();
    const response = await supertest(app)
      .post("/api/rooms/room-1/questions/q-high/rating")
      .send({ rating: 5, participantId: "participant-1" });

    expect(response.status).toBe(201);
    expect(mockRecordQuestionRated).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-1",
        questionId: "q-high",
        rating: 5,
        participantId: "participant-1",
      }),
    );
  });

  it("biases round selection toward higher-rated eligible questions", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-1",
      round: 1,
      maxSuitors: 3,
      config: {
        categoryWeights: { general: 1, fun: 0, deep: 0 },
        difficultyPlan: ["easy"],
        disallowRepeatsInGame: true,
      },
    });

    expect(result.usedFallback).toBe(false);
    expect(result.questions[0]?.id).toBe("q-high");
  });
});
