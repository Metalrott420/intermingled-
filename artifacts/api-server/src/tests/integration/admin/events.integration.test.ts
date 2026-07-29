import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import supertest from "supertest";

const { mockGetAuth, mockSendPushNotifications, mockTrackGameplayEvent } = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockSendPushNotifications: vi.fn(),
  mockTrackGameplayEvent: vi.fn(),
}));

const now = new Date("2026-07-20T23:30:00.000Z");
let eventRows = [
  {
    id: "event-1",
    title: "Friday Ballroom",
    description: "Live session",
    status: "scheduled" as const,
    startsAt: new Date("2026-07-22T01:00:00.000Z"),
    endsAt: null,
    isFeatured: true,
    metadata: {},
    createdByUserId: "admin-1",
    createdAt: now,
    updatedAt: now,
  },
];

const recipientRows = [
  { id: "u-1", expoPushToken: "ExponentPushToken[abc]" },
  { id: "u-2", expoPushToken: "ExponentPushToken[def]" },
];

function getEqValue(expression: any): string | null {
  return expression?.right?.value ?? expression?.right?.val ?? null;
}

vi.mock("@clerk/express", () => ({
  getAuth: mockGetAuth,
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", clerkId: "clerkId", isAdmin: "isAdmin", expoPushToken: "expoPushToken" };
  const ballroomEventsTable = { id: "id", startsAt: "startsAt" };

  const db = {
    select: vi.fn((selection?: unknown) => ({
      from: vi.fn((table: unknown) => {
        if (table === usersTable) {
          if (selection && typeof selection === "object" && "expoPushToken" in (selection as Record<string, unknown>)) {
            return {
              where: vi.fn(async () => recipientRows),
            };
          }

          return {
            where: vi.fn(async () => [{ id: "admin-1", clerkId: "clerk-admin", isAdmin: true }]),
          };
        }

        if (table === ballroomEventsTable) {
          return {
            orderBy: vi.fn(async () => eventRows),
            where: vi.fn(async () => {
              const latest = eventRows[eventRows.length - 1];
              return latest ? [latest] : [];
            }),
          };
        }

        return {
          where: vi.fn(async () => []),
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (payload: any) => {
        if (table === ballroomEventsTable) {
          eventRows.push({
            ...payload,
            description: payload.description ?? null,
            endsAt: payload.endsAt ?? null,
            metadata: payload.metadata ?? {},
            createdByUserId: payload.createdByUserId ?? null,
          });
        }
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((patch: any) => ({
        where: vi.fn(async (expression: unknown) => {
          if (table !== ballroomEventsTable) return;
          const id = getEqValue(expression as any);
          const current = eventRows.find((row) => row.id === id);
          if (!current) return;
          Object.assign(current, patch);
        }),
      })),
    })),
  };

  return {
    db,
    usersTable,
    reportsTable: {},
    roomsTable: {},
    ballroomEventsTable,
  };
});

vi.mock("../../../lib/pushNotifications.js", () => ({
  sendPushNotifications: mockSendPushNotifications,
}));

vi.mock("../../../services/analyticsService.js", () => ({
  trackGameplayEvent: mockTrackGameplayEvent,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import eventsRouter from "../../../routes/events.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", eventsRouter);
  return app;
}

describe("Events integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    eventRows = [
      {
        id: "event-1",
        title: "Friday Ballroom",
        description: "Live session",
        status: "scheduled",
        startsAt: new Date("2026-07-22T01:00:00.000Z"),
        endsAt: null,
        isFeatured: true,
        metadata: {},
        createdByUserId: "admin-1",
        createdAt: now,
        updatedAt: now,
      },
    ];
    mockGetAuth.mockReturnValue({ userId: "clerk-admin" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GET /api/events lists ballroom events", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/events?limit=10");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("event-1");
  });

  it("GET /api/events/featured returns the featured event", async () => {
    const app = buildApp();
    const response = await supertest(app).get("/api/events/featured");

    expect(response.status).toBe(200);
    expect(response.body.id).toBe("event-1");
    expect(response.body.isFeatured).toBe(true);
  });

  it("POST /api/admin/events blocks unauthenticated users", async () => {
    mockGetAuth.mockReturnValue({ userId: null });

    const app = buildApp();
    const response = await supertest(app).post("/api/admin/events").send({
      title: "Ballroom 2",
      startsAt: "2026-07-23T01:00:00.000Z",
    });

    expect(response.status).toBe(401);
  });

  it("POST /api/admin/events creates a new ballroom event", async () => {
    const app = buildApp();
    const response = await supertest(app).post("/api/admin/events").send({
      title: "Ballroom 2",
      description: "Second drop",
      startsAt: "2026-07-23T01:00:00.000Z",
      isFeatured: false,
    });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("Ballroom 2");
    expect(eventRows.length).toBe(2);
  });

  it("POST /api/admin/events/:id/notify dispatches push payloads", async () => {
    const app = buildApp();
    const response = await supertest(app).post("/api/admin/events/event-1/notify").send({
      title: "Starting soon",
      body: "Join the ballroom now",
    });

    expect(response.status).toBe(200);
    expect(response.body.notifiedCount).toBe(2);
    expect(mockSendPushNotifications).toHaveBeenCalledTimes(1);
    expect(mockTrackGameplayEvent).toHaveBeenCalledWith(
      "ballroom_event_notified",
      expect.objectContaining({ eventId: "event-1", notifiedCount: 2 }),
    );
  });
});
