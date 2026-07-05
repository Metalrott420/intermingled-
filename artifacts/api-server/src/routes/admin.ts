import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, count, inArray } from "drizzle-orm";
import { db, usersTable, reportsTable, roomsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, auth.userId));
  if (!user?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  req.adminUser = user;
  next();
};

// GET /api/admin/stats — summary counts
router.get("/admin/stats", requireAdmin, async (_req, res) => {
  try {
    const [[{ total: totalUsers }], [{ total: totalRooms }], [{ total: openReports }]] = await Promise.all([
      db.select({ total: count() }).from(usersTable),
      db.select({ total: count() }).from(roomsTable),
      db.select({ total: count() }).from(reportsTable),
    ]);
    res.json({ totalUsers, totalRooms, openReports });
  } catch (err) {
    logger.error({ err }, "GET /admin/stats error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/users — all users, most recent first
router.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        status: usersTable.status,
        isAdmin: usersTable.isAdmin,
        isBanned: usersTable.isBanned,
        gender: usersTable.gender,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(500);
    res.json(users);
  } catch (err) {
    logger.error({ err }, "GET /admin/users error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/reports — all reports, most recent first, enriched with user names
router.get("/admin/reports", requireAdmin, async (_req, res) => {
  try {
    const reports = await db
      .select()
      .from(reportsTable)
      .orderBy(desc(reportsTable.createdAt))
      .limit(200);

    if (reports.length === 0) { res.json([]); return; }

    const userIds = [...new Set([...reports.map((r) => r.reporterId), ...reports.map((r) => r.reportedId)])];
    const userRows = await db
      .select({ id: usersTable.id, name: usersTable.name, isBanned: usersTable.isBanned })
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));

    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

    const enriched = reports.map((r) => ({
      ...r,
      reporterName: userMap[r.reporterId]?.name ?? "Unknown",
      reportedName: userMap[r.reportedId]?.name ?? "Unknown",
      reportedIsBanned: userMap[r.reportedId]?.isBanned ?? false,
    }));

    res.json(enriched);
  } catch (err) {
    logger.error({ err }, "GET /admin/reports error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/rooms — all rooms
router.get("/admin/rooms", requireAdmin, async (_req, res) => {
  try {
    const rooms = await db.select().from(roomsTable).orderBy(desc(roomsTable.createdAt)).limit(200);
    res.json(rooms);
  } catch (err) {
    logger.error({ err }, "GET /admin/rooms error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/ban
router.post("/admin/users/:id/ban", requireAdmin, async (req: any, res) => {
  try {
    if (req.params.id === req.adminUser.id) { res.status(400).json({ error: "Cannot ban yourself" }); return; }
    await db.update(usersTable).set({ isBanned: true }).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/ban error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/unban
router.post("/admin/users/:id/unban", requireAdmin, async (req: any, res) => {
  try {
    await db.update(usersTable).set({ isBanned: false }).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/unban error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/grant-admin
router.post("/admin/users/:id/grant-admin", requireAdmin, async (req: any, res) => {
  try {
    await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/grant-admin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/users/:id/revoke-admin
router.post("/admin/users/:id/revoke-admin", requireAdmin, async (req: any, res) => {
  try {
    if (req.params.id === req.adminUser.id) { res.status(400).json({ error: "Cannot revoke your own admin" }); return; }
    await db.update(usersTable).set({ isAdmin: false }).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /admin/users/:id/revoke-admin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
