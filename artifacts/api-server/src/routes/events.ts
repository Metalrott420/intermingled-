import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { asc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db, ballroomEventsTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { sendPushNotifications } from "../lib/pushNotifications";
import { trackGameplayEvent } from "../services/analyticsService";
import { makeId } from "../services/utils";

const router: IRouter = Router();

const BallroomEventStatus = z.enum(["scheduled", "live", "completed", "cancelled"]);

const CreateBallroomEventBody = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  status: BallroomEventStatus.optional(),
  isFeatured: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateBallroomEventBody = z
  .object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(1000).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    status: BallroomEventStatus.optional(),
    isFeatured: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const NotifyBallroomEventBody = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(240).optional(),
  dryRun: z.boolean().optional(),
});

const requireAdmin = async (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  req.adminUser = user;
  next();
};

function serializeBallroomEvent(event: {
  id: string;
  title: string;
  description: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  startsAt: Date;
  endsAt: Date | null;
  isFeatured: boolean;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt ? event.endsAt.toISOString() : null,
    isFeatured: event.isFeatured,
    metadata: event.metadata,
    createdByUserId: event.createdByUserId,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

// GET /api/events
router.get("/events", async (req, res) => {
  try {
    const status = BallroomEventStatus.safeParse(req.query.status);
    const featuredOnly = req.query.featured === "true";
    const limit = Math.max(1, Math.min(100, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const rows = await db
      .select()
      .from(ballroomEventsTable)
      .orderBy(asc(ballroomEventsTable.startsAt));

    const filtered = rows
      .filter((event) => (status.success ? event.status === status.data : true))
      .filter((event) => (featuredOnly ? event.isFeatured : true))
      .slice(0, limit)
      .map(serializeBallroomEvent);

    res.json(filtered);
  } catch (err) {
    logger.error({ err }, "GET /events error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/events/featured
router.get("/events/featured", async (_req, res) => {
  try {
    const now = Date.now();
    const rows = await db
      .select()
      .from(ballroomEventsTable)
      .orderBy(asc(ballroomEventsTable.startsAt));

    const featured = rows
      .filter((event) => event.isFeatured)
      .filter((event) => event.status === "scheduled" || event.status === "live")
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
      .find((event) => event.startsAt.getTime() >= now - 1000 * 60 * 60 * 6);

    if (!featured) {
      res.status(404).json({ error: "No featured event" });
      return;
    }

    res.json(serializeBallroomEvent(featured));
  } catch (err) {
    logger.error({ err }, "GET /events/featured error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/events
router.post("/admin/events", requireAdmin, async (req: any, res) => {
  const parsed = CreateBallroomEventBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  try {
    const now = new Date();
    const id = makeId();

    await db.insert(ballroomEventsTable).values({
      id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      status: parsed.data.status ?? "scheduled",
      startsAt: new Date(parsed.data.startsAt),
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      isFeatured: parsed.data.isFeatured ?? false,
      metadata: parsed.data.metadata ?? {},
      createdByUserId: req.adminUser.id,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(ballroomEventsTable).where(eq(ballroomEventsTable.id, id));
    if (!created) {
      res.status(500).json({ error: "Failed to create event" });
      return;
    }

    res.status(201).json(serializeBallroomEvent(created));
  } catch (err) {
    logger.error({ err }, "POST /admin/events error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/admin/events/:id
router.patch("/admin/events/:id", requireAdmin, async (req, res) => {
  const parsed = UpdateBallroomEventBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  try {
    const patch = parsed.data;
    await db
      .update(ballroomEventsTable)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.startsAt !== undefined ? { startsAt: new Date(patch.startsAt) } : {}),
        ...(patch.endsAt !== undefined ? { endsAt: new Date(patch.endsAt) } : {}),
        ...(patch.isFeatured !== undefined ? { isFeatured: patch.isFeatured } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        updatedAt: new Date(),
      })
      .where(eq(ballroomEventsTable.id, req.params.id));

    const [updated] = await db.select().from(ballroomEventsTable).where(eq(ballroomEventsTable.id, req.params.id));
    if (!updated) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    res.json(serializeBallroomEvent(updated));
  } catch (err) {
    logger.error({ err }, "PATCH /admin/events/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/events/:id/notify
router.post("/admin/events/:id/notify", requireAdmin, async (req, res) => {
  const parsed = NotifyBallroomEventBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  try {
    const [event] = await db.select().from(ballroomEventsTable).where(eq(ballroomEventsTable.id, req.params.id));
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const users = await db
      .select({ id: usersTable.id, expoPushToken: usersTable.expoPushToken })
      .from(usersTable)
      .where(isNotNull(usersTable.expoPushToken));

    const payloads = users
      .filter((user) => typeof user.expoPushToken === "string" && user.expoPushToken.length > 0)
      .map((user) => ({
        to: user.expoPushToken as string,
        title: parsed.data.title ?? "Ballroom Event",
        body: parsed.data.body ?? `${event.title} starts soon. Join now and go live.`,
        data: { type: "ballroom_event", eventId: event.id },
      }));

    if (!parsed.data.dryRun) {
      await sendPushNotifications(payloads);
      await trackGameplayEvent("ballroom_event_notified", {
        eventId: event.id,
        notifiedCount: payloads.length,
      });
    }

    res.json({ ok: true, notifiedCount: payloads.length, dryRun: Boolean(parsed.data.dryRun) });
  } catch (err) {
    logger.error({ err }, "POST /admin/events/:id/notify error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
