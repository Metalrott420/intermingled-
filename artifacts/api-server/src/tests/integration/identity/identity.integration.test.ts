import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockSelectWhere,
  mockUpdateWhere,
  mockVerificationCreate,
  mockVerificationRetrieve,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockVerificationCreate: vi.fn(),
  mockVerificationRetrieve: vi.fn(),
}));

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

let currentUser: any;

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", clerkId: "clerkId" };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((patch: any) => ({
        where: vi.fn(async () => {
          Object.assign(currentUser, patch);
          return [];
        }),
      })),
    })),
  };

  return {
    db,
    usersTable,
  };
});

vi.mock("../../../stripeClient.js", () => ({
  getUncachableStripeClient: vi.fn(async () => ({
    identity: {
      verificationSessions: {
        create: mockVerificationCreate,
        retrieve: mockVerificationRetrieve,
      },
    },
  })),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import identityRouter from "../../../routes/identity.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", identityRouter);
  return app;
}

describe("Identity integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-1" });

    currentUser = {
      id: "user-1",
      clerkId: "clerk-1",
      ageVerified: false,
      identitySessionId: null,
    };

    mockSelectWhere.mockResolvedValue([currentUser]);
    mockUpdateWhere.mockResolvedValue([]);

    mockVerificationCreate.mockResolvedValue({
      id: "vs_1",
      url: "https://verify.example.com/session/vs_1",
    });

    mockVerificationRetrieve.mockResolvedValue({
      status: "verified",
      verified_outputs: {
        dob: { year: 1995, month: 6, day: 10 },
      },
    });
  });

  it("POST /api/identity/start returns alreadyVerified when user is already verified", async () => {
    currentUser.ageVerified = true;

    const app = buildApp();
    const response = await supertest(app).post("/api/identity/start");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ alreadyVerified: true });
    expect(mockVerificationCreate).not.toHaveBeenCalled();
  });

  it("POST /api/identity/start creates a verification session", async () => {
    const app = buildApp();
    const response = await supertest(app)
      .post("/api/identity/start")
      .set("x-forwarded-proto", "https")
      .set("x-forwarded-host", "app.example.com");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      url: "https://verify.example.com/session/vs_1",
      sessionId: "vs_1",
    });
    expect(currentUser.identitySessionId).toBe("vs_1");
  });

  it("GET /api/identity/status returns not_started when no session exists", async () => {
    currentUser.identitySessionId = null;

    const app = buildApp();
    const response = await supertest(app).get("/api/identity/status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ verified: false, status: "not_started" });
  });

  it("GET /api/identity/status marks eligible user as verified", async () => {
    currentUser.identitySessionId = "vs_1";

    const app = buildApp();
    const response = await supertest(app).get("/api/identity/status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ verified: true, status: "verified" });
    expect(currentUser.ageVerified).toBe(true);
  });
});
