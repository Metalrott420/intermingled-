import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockQuestionRows,
  mockArchives,
  mockPerformanceSnapshots,
} = vi.hoisted(() => ({
  mockQuestionRows: vi.fn(),
  mockArchives: vi.fn(),
  mockPerformanceSnapshots: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const questionBankTable = {
    id: "id",
    isActive: "isActive",
    updatedAt: "updatedAt",
    completionTimestamp: "completionTimestamp",
  };
  const gameArchivesTable = {
    questionsAsked: "questionsAsked",
    completionTimestamp: "completionTimestamp",
  };

  const db = {
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
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => []),
      })),
    })),
  };

  return {
    db,
    questionBankTable,
    gameArchivesTable,
  };
});

vi.mock("../../../services/questionTelemetryService.js", () => ({
  getQuestionPerformanceSnapshots: mockPerformanceSnapshots,
}));

import { selectRoundQuestionsForRoom } from "../../../services/questionService.js";

function makeRows() {
  return [
    { id: "q1", packSlug: "core", category: "general", difficulty: "easy", content: "Easy general A", normalizedHash: "5f3dc556cd296d3b0d6e4e1410f43f4927ff0da4ae3df61f4d04402f088da12f", isActive: true, updatedAt: new Date() },
    { id: "q2", packSlug: "core", category: "fun", difficulty: "easy", content: "Easy fun A", normalizedHash: "h2", isActive: true, updatedAt: new Date() },
    { id: "q3", packSlug: "core", category: "deep", difficulty: "medium", content: "Medium deep A", normalizedHash: "h3", isActive: true, updatedAt: new Date() },
    { id: "q4", packSlug: "seasonal-summer", category: "fun", difficulty: "hard", content: "Hard fun summer", normalizedHash: "h4", isActive: true, updatedAt: new Date() },
    { id: "q5", packSlug: "premium-intense", category: "deep", difficulty: "hard", content: "Hard deep premium", normalizedHash: "h5", isActive: true, updatedAt: new Date() },
    { id: "q6", packSlug: "archived", category: "general", difficulty: "easy", content: "Archived should not appear", normalizedHash: "h6", isActive: false, updatedAt: new Date() },
  ];
}

describe("Question selection integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuestionRows.mockReturnValue(makeRows());
    mockArchives.mockReturnValue([]);
    mockPerformanceSnapshots.mockResolvedValue(new Map());
  });

  it("does not return duplicate questions already used in the same game", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-1",
      round: 1,
      maxSuitors: 3,
      previouslyUsedQuestionIds: ["q1"],
      config: {
        disallowRepeatsInGame: true,
        categoryWeights: { general: 1, fun: 0, deep: 0 },
      },
    });

    const ids = result.questions.map((question) => question.id).filter(Boolean);
    expect(ids).not.toContain("q1");
    expect(result.usedFallback).toBe(false);
  });

  it("filters by configured difficulty progression", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-2",
      round: 3,
      maxSuitors: 5,
      config: {
        difficultyPlan: ["easy", "easy", "medium", "medium", "hard"],
      },
    });

    expect(result.difficultyApplied).toBe("medium");
    expect(result.questions.every((question) => question.difficulty === "medium")).toBe(true);
  });

  it("respects pack strategy filters", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-3",
      round: 1,
      maxSuitors: 4,
      config: {
        packStrategy: { mode: "single", packSlug: "seasonal-summer" },
        difficultyPlan: ["hard"],
      },
    });

    expect(result.questions.every((question) => question.packSlug === "seasonal-summer")).toBe(true);
  });

  it("respects category weighting when only one category is enabled", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-4",
      round: 1,
      maxSuitors: 4,
      config: {
        categoryWeights: { general: 0, fun: 1, deep: 0 },
      },
    });

    expect(result.questions.every((question) => question.category === "fun")).toBe(true);
  });

  it("uses fallback only when configured pool cannot satisfy selection", async () => {
    const result = await selectRoundQuestionsForRoom({
      roomId: "room-5",
      round: 5,
      maxSuitors: 6,
      config: {
        packStrategy: { mode: "single", packSlug: "missing-pack" },
      },
    });

    expect(result.usedFallback).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it("avoids recently used questions from recent games", async () => {
    mockArchives.mockReturnValue([
      {
        questionsAsked: [{ content: "Easy general A" }],
      },
    ]);

    const result = await selectRoundQuestionsForRoom({
      roomId: "room-6",
      round: 1,
      maxSuitors: 3,
      config: {
        avoidRecentGames: 5,
        categoryWeights: { general: 1, fun: 0, deep: 0 },
      },
    });

    expect(result.questions.find((question) => question.question === "Easy general A")).toBeUndefined();
    expect(result.usedFallback).toBe(false);
  });

  it("uses fallback gracefully when configured pack has no eligible questions", async () => {
    mockQuestionRows.mockReturnValue([]);

    const result = await selectRoundQuestionsForRoom({
      roomId: "room-7",
      round: 1,
      maxSuitors: 3,
      config: {
        packStrategy: { mode: "single", packSlug: "empty-pack" },
      },
    });

    expect(result.usedFallback).toBe(true);
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
