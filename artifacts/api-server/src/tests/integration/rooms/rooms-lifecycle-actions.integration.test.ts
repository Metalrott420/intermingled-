import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockVerifyChooser,
  mockEliminateSuitor,
  mockAdvanceRound,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockVerifyChooser: vi.fn(),
  mockEliminateSuitor: vi.fn(),
  mockAdvanceRound: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    query: {
      usersTable: { findFirst: vi.fn() },
      roomsTable: { findFirst: vi.fn() },
      questionBankTable: { findFirst: vi.fn() },
      participantsTable: { findFirst: vi.fn() },
    },
  },
  roomsTable: { id: "id" },
  participantsTable: { id: "id", roomId: "roomId" },
  usersTable: { id: "id", clerkId: "clerkId" },
  questionBankTable: { id: "id" },
}));

vi.mock("../../../services/gameSessionService.js", () => ({
  createGameSession: vi.fn(),
  getJoinableRooms: vi.fn(),
  getRoomById: vi.fn(),
  joinGameSession: vi.fn(),
  verifyChooser: mockVerifyChooser,
}));

vi.mock("../../../services/matchmakingService.js", () => ({
  createMatchSession: vi.fn(),
  getCachedPremiumForJoiningUser: vi.fn(),
}));

vi.mock("../../../services/gameFlowService.js", () => ({
  advanceRound: mockAdvanceRound,
  chooseWinner: vi.fn(),
  eliminateSuitor: mockEliminateSuitor,
}));

vi.mock("../../../services/messagingService.js", () => ({
  getRoomMessagesForUser: vi.fn(),
}));

vi.mock("../../../services/questionTelemetryService.js", () => ({
  recordQuestionRated: vi.fn(),
}));

vi.mock("../../../socket.js", () => ({
  getIo: vi.fn(() => ({ to: vi.fn(() => ({ emit: vi.fn() })) })),
}));

import roomsRouter from "../../../routes/rooms.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", roomsRouter);
  return app;
}

describe("Rooms lifecycle actions integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-1" });
    mockVerifyChooser.mockResolvedValue({ room: { id: "room-1" }, user: { id: "user-1" } });
    mockEliminateSuitor.mockResolvedValue({ id: "room-1", status: "active", currentRound: 1 });
    mockAdvanceRound.mockResolvedValue({ id: "room-1", status: "active", currentRound: 2 });
  });

  it("POST /api/rooms/:id/eliminate returns 400 when participantId is missing", async () => {
    const app = buildApp();
    const response = await supertest(app).post("/api/rooms/room-1/eliminate").send({});

    expect(response.status).toBe(400);
  });

  it("POST /api/rooms/:id/eliminate returns 403 when caller is not chooser", async () => {
    mockVerifyChooser.mockResolvedValue(null);

    const app = buildApp();
    const response = await supertest(app)
      .post("/api/rooms/room-1/eliminate")
      .send({ participantId: "participant-1" });

    expect(response.status).toBe(403);
  });

  it("POST /api/rooms/:id/eliminate returns updated room on success", async () => {
    const app = buildApp();
    const response = await supertest(app)
      .post("/api/rooms/room-1/eliminate")
      .send({ participantId: "participant-1" });

    expect(response.status).toBe(200);
    expect(response.body.currentRound).toBe(1);
    expect(mockEliminateSuitor).toHaveBeenCalledWith("room-1", "participant-1");
  });

  it("POST /api/rooms/:id/advance-round returns 403 when caller is not chooser", async () => {
    mockVerifyChooser.mockResolvedValue(null);

    const app = buildApp();
    const response = await supertest(app).post("/api/rooms/room-1/advance-round");

    expect(response.status).toBe(403);
  });

  it("POST /api/rooms/:id/advance-round returns updated room on success", async () => {
    const app = buildApp();
    const response = await supertest(app).post("/api/rooms/room-1/advance-round");

    expect(response.status).toBe(200);
    expect(response.body.currentRound).toBe(2);
    expect(mockAdvanceRound).toHaveBeenCalledWith("room-1");
  });
});
