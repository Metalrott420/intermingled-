import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockSelectWhere,
  mockListQuestions,
  mockCreateQuestion,
  mockUpdateQuestion,
  mockArchiveQuestion,
  mockListQuestionPacks,
  mockGetQuestionIntelligenceDashboard,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockListQuestions: vi.fn(),
  mockCreateQuestion: vi.fn(),
  mockUpdateQuestion: vi.fn(),
  mockArchiveQuestion: vi.fn(),
  mockListQuestionPacks: vi.fn(),
  mockGetQuestionIntelligenceDashboard: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
  },
  usersTable: { id: "id", clerkId: "clerkId", isAdmin: "isAdmin" },
  reportsTable: {},
  roomsTable: {},
}));

vi.mock("../../../services/questionService.js", () => ({
  listQuestions: mockListQuestions,
  createQuestion: mockCreateQuestion,
  updateQuestion: mockUpdateQuestion,
  archiveQuestion: mockArchiveQuestion,
  listQuestionPacks: mockListQuestionPacks,
}));

vi.mock("../../../services/questionTelemetryService.js", () => ({
  getQuestionIntelligenceDashboard: mockGetQuestionIntelligenceDashboard,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import adminRouter from "../../../routes/admin.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", adminRouter);
  return app;
}

describe("Admin questions integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-admin" });
    mockSelectWhere.mockResolvedValue([{ id: "admin-1", clerkId: "clerk-admin", isAdmin: true }]);
    mockListQuestionPacks.mockResolvedValue([{ packSlug: "core", total: 10, active: 9 }]);
    mockListQuestions.mockResolvedValue({ items: [], total: 0 });
    mockCreateQuestion.mockResolvedValue({ id: "q-1", content: "Question", packSlug: "core", category: "general", difficulty: "easy", isActive: true });
    mockUpdateQuestion.mockResolvedValue({ id: "q-1", content: "Question", packSlug: "core", category: "general", difficulty: "easy", isActive: true });
    mockArchiveQuestion.mockResolvedValue({ id: "q-1", isActive: false });
    mockGetQuestionIntelligenceDashboard.mockResolvedValue({
      leaderboard: [],
      lowestPerforming: [],
      packRankings: [],
      categoryRankings: [],
      difficultyRankings: [],
      ratingTrends: [],
      responseTimeTrends: [],
      exposureMetrics: {
        activeQuestions: 0,
        totalExposureCount: 0,
        recentExposureCount: 0,
        averageExposurePerQuestion: 0,
        recentWindowDays: 14,
      },
    });
  });

  it("blocks unauthenticated question list", async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const app = buildApp();
    const response = await supertest(app).get("/api/admin/questions");
    expect(response.status).toBe(401);
  });

  it("GET /api/admin/questions returns paginated payload", async () => {
    mockListQuestions.mockResolvedValueOnce({
      items: [{ id: "q-1", content: "What makes you laugh?", packSlug: "core", category: "fun", difficulty: "easy", isActive: true }],
      total: 1,
    });

    const app = buildApp();
    const response = await supertest(app).get("/api/admin/questions?page=1&limit=25&category=fun");

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.pagination.total).toBe(1);
  });

  it("POST /api/admin/questions returns 409 for duplicate content", async () => {
    mockCreateQuestion.mockRejectedValueOnce(new Error("Duplicate question content"));

    const app = buildApp();
    const response = await supertest(app)
      .post("/api/admin/questions")
      .send({ content: "What makes you laugh?", packSlug: "core", category: "fun", difficulty: "easy" });

    expect(response.status).toBe(409);
  });

  it("POST /api/admin/questions/:id/archive archives a question", async () => {
    const app = buildApp();
    const response = await supertest(app).post("/api/admin/questions/q-1/archive");

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
  });

  it("GET /api/admin/question-analytics returns the question intelligence dashboard", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/admin/question-analytics?limit=10&days=30");

    expect(response.status).toBe(200);
    expect(response.body.leaderboard).toEqual([]);
    expect(mockGetQuestionIntelligenceDashboard).toHaveBeenCalledWith(10, 30);
  });
});
