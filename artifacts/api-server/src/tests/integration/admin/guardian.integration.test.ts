import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const {
  mockGetAuth,
  mockSelectFrom,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockSelectFrom: vi.fn(),
}));

const reportRows = [
  {
    id: "report-1",
    reporterId: "user-1",
    reportedId: "user-2",
    reason: "harassment",
    detail: "Spamming the room",
    createdAt: new Date("2026-07-20T00:01:00.000Z"),
  },
  {
    id: "report-2",
    reporterId: "user-3",
    reportedId: "user-2",
    reason: "spam",
    detail: null,
    createdAt: new Date("2026-07-19T00:01:00.000Z"),
  },
];

const blockRows = [
  {
    blockerId: "user-1",
    blockedId: "user-4",
    createdAt: new Date("2026-07-20T00:02:00.000Z"),
  },
  {
    blockerId: "user-2",
    blockedId: "user-5",
    createdAt: new Date("2026-07-18T00:02:00.000Z"),
  },
];

const users = [
  { id: "admin-1", clerkId: "clerk-admin", name: "Admin", isAdmin: true, isBanned: false },
  { id: "user-1", name: "Ava", isBanned: false },
  { id: "user-2", name: "Blake", isBanned: true },
  { id: "user-3", name: "Casey", isBanned: false },
  { id: "user-4", name: "Drew", isBanned: false },
  { id: "user-5", name: "Emery", isBanned: false },
];

function createSelectableRows<T>(rows: T[]) {
  return {
    orderBy: vi.fn(() => ({
      limit: vi.fn(async () => rows),
    })),
    then: (resolve: (value: T[]) => void) => resolve(rows),
  };
}

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", clerkId: "clerkId", name: "name", isAdmin: "isAdmin", isBanned: "isBanned" };
  const reportsTable = { createdAt: "createdAt", reporterId: "reporterId", reportedId: "reportedId" };
  const blocksTable = { createdAt: "createdAt", blockerId: "blockerId", blockedId: "blockedId" };

  const db = {
    select: vi.fn((selection?: unknown) => ({
      from: vi.fn((table: unknown) => {
        if (table === usersTable) {
          if (selection && typeof selection === "object" && "total" in (selection as Record<string, unknown>)) {
            return {
              where: vi.fn(async () => [{ total: 1 }]),
            };
          }

          return {
            where: vi.fn(async () => users),
          };
        }

        if (selection && typeof selection === "object" && "total" in (selection as Record<string, unknown>)) {
          if (table === reportsTable) return Promise.resolve([{ total: reportRows.length }]);
          if (table === blocksTable) return Promise.resolve([{ total: blockRows.length }]);
          if (table === usersTable) return Promise.resolve([{ total: 1 }]);
        }

        if (table === reportsTable && selection === undefined) {
          return createSelectableRows(reportRows);
        }

        if (table === reportsTable) {
          return createSelectableRows(reportRows);
        }

        if (table === blocksTable && selection === undefined) {
          return createSelectableRows(blockRows);
        }

        if (table === blocksTable) {
          return createSelectableRows(blockRows);
        }

        if (table === usersTable) {
          return {
            where: vi.fn(async () => users),
          };
        }

        return {
          where: vi.fn(async () => []),
        };
      }),
    })),
  };

  return {
    db,
    usersTable,
    reportsTable,
    roomsTable: {},
    blocksTable,
  };
});

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

describe("Guardian integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuth.mockReturnValue({ userId: "clerk-admin" });
  });

  it("GET /api/admin/guardian returns moderation overview and queues", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/admin/guardian");

    expect(response.status).toBe(200);
    expect(response.body.overview.totalReports).toBe(2);
    expect(response.body.overview.totalBlocks).toBe(2);
    expect(response.body.overview.bannedUsers).toBe(1);
    expect(response.body.recentReports).toHaveLength(2);
    expect(response.body.recentBlocks).toHaveLength(2);
    expect(response.body.topReportedUsers[0]).toMatchObject({
      userId: "user-2",
      userName: "Blake",
      reportCount: 2,
      isBanned: true,
    });
  });

  it("blocks non-admin users from the guardian dashboard", async () => {
    mockGetAuth.mockReturnValue({ userId: null });
    const app = buildApp();
    const response = await supertest(app).get("/api/admin/guardian");

    expect(response.status).toBe(401);
  });
});
