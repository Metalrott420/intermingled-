import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, desc, count, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable, reportsTable, roomsTable, blocksTable } from "@workspace/db";
import { logger } from "../lib/logger";
import {
  archiveQuestion,
  createQuestion,
  listQuestionPacks,
  listQuestions,
  updateQuestion,
} from "../services/questionService";
import { getQuestionIntelligenceDashboard } from "../services/questionTelemetryService";

const router: IRouter = Router();

const QuestionCategory = z.enum(["general", "fun", "deep"]);
const QuestionDifficulty = z.enum(["easy", "medium", "hard"]);

const CreateQuestionBody = z.object({
  content: z.string().min(1),
  packSlug: z.string().min(1).max(64),
  category: QuestionCategory,
  difficulty: QuestionDifficulty,
});

const UpdateQuestionBody = z
  .object({
    content: z.string().min(1).optional(),
    packSlug: z.string().min(1).max(64).optional(),
    category: QuestionCategory.optional(),
    difficulty: QuestionDifficulty.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

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

router.get("/admin/question-packs", requireAdmin, async (_req: any, res) => {
  try {
    const packs = await listQuestionPacks();
    res.json(packs);
  } catch (err) {
    logger.error({ err }, "GET /admin/question-packs error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/question-analytics", requireAdmin, async (req: any, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const days = Math.min(90, Math.max(1, Number.parseInt(String(req.query.days ?? "14"), 10) || 14));
    const dashboard = await getQuestionIntelligenceDashboard(limit, days);
    res.json(dashboard);
  } catch (err) {
    logger.error({ err }, "GET /admin/question-analytics error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/guardian", requireAdmin, async (_req, res) => {
  try {
    const recentReportRows = await db
      .select()
      .from(reportsTable)
      .orderBy(desc(reportsTable.createdAt))
      .limit(10);

    const recentBlockRows = await db
      .select()
      .from(blocksTable)
      .orderBy(desc(blocksTable.createdAt))
      .limit(10);

    const userIds = [
      ...new Set([
        ...recentReportRows.flatMap((row) => [row.reporterId, row.reportedId]),
        ...recentBlockRows.flatMap((row) => [row.blockerId, row.blockedId]),
      ]),
    ];

    const userRows = userIds.length > 0
      ? await db.select({ id: usersTable.id, name: usersTable.name, isBanned: usersTable.isBanned }).from(usersTable).where(inArray(usersTable.id, userIds))
      : [];
    const userMap = Object.fromEntries(userRows.map((user) => [user.id, user]));

    const totalReportsRows = await db.select({ total: count() }).from(reportsTable);
    const totalBlocksRows = await db.select({ total: count() }).from(blocksTable);
    const totalReports = totalReportsRows[0]?.total ?? 0;
    const totalBlocks = totalBlocksRows[0]?.total ?? 0;
    const bannedUsersRows = await db.select({ total: count() }).from(usersTable).where(eq(usersTable.isBanned, true));
    const bannedUsers = bannedUsersRows[0]?.total ?? 0;

    const topReportedCounts = new Map<string, number>();
    for (const row of await db.select().from(reportsTable)) {
      topReportedCounts.set(row.reportedId, (topReportedCounts.get(row.reportedId) ?? 0) + 1);
    }

    const topReportedUsers = [...topReportedCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([userId, reportCount]) => ({
        userId,
        userName: userMap[userId]?.name ?? "Unknown",
        reportCount,
        isBanned: userMap[userId]?.isBanned ?? false,
      }));

    res.json({
      overview: {
        totalReports,
        totalBlocks,
        bannedUsers,
        recentReportCount: recentReportRows.length,
        recentBlockCount: recentBlockRows.length,
      },
      recentReports: recentReportRows.map((report) => ({
        id: report.id,
        reporterId: report.reporterId,
        reporterName: userMap[report.reporterId]?.name ?? "Unknown",
        reportedId: report.reportedId,
        reportedName: userMap[report.reportedId]?.name ?? "Unknown",
        reportedIsBanned: userMap[report.reportedId]?.isBanned ?? false,
        reason: report.reason,
        detail: report.detail,
        createdAt: report.createdAt,
      })),
      recentBlocks: recentBlockRows.map((block) => ({
        blockerId: block.blockerId,
        blockerName: userMap[block.blockerId]?.name ?? "Unknown",
        blockedId: block.blockedId,
        blockedName: userMap[block.blockedId]?.name ?? "Unknown",
        createdAt: block.createdAt,
      })),
      topReportedUsers,
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/guardian error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/questions", requireAdmin, async (req: any, res) => {
  try {
    const page = Number.parseInt(String(req.query.page ?? "1"), 10);
    const limit = Number.parseInt(String(req.query.limit ?? "25"), 10);
    const safePage = Number.isNaN(page) ? 1 : Math.max(1, page);
    const safeLimit = Number.isNaN(limit) ? 25 : Math.min(100, Math.max(1, limit));

    const result = await listQuestions({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      packSlug: typeof req.query.packSlug === "string" ? req.query.packSlug : undefined,
      category: req.query.category === "general" || req.query.category === "fun" || req.query.category === "deep" ? req.query.category : undefined,
      difficulty: req.query.difficulty === "easy" || req.query.difficulty === "medium" || req.query.difficulty === "hard" ? req.query.difficulty : undefined,
      isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
      limit: safeLimit,
      offset: (safePage - 1) * safeLimit,
    });

    res.json({
      items: result.items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / safeLimit)),
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /admin/questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/questions", requireAdmin, async (req: any, res) => {
  const body = CreateQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const created = await createQuestion({
      ...body.data,
      createdByUserId: req.adminUser.id,
    });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof Error && err.message === "Duplicate question content") {
      res.status(409).json({ error: err.message });
      return;
    }
    logger.error({ err }, "POST /admin/questions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/questions/:id", requireAdmin, async (req: any, res) => {
  const body = UpdateQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const updated = await updateQuestion(req.params.id, body.data);
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "Question not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof Error && err.message === "Duplicate question content") {
      res.status(409).json({ error: err.message });
      return;
    }
    logger.error({ err }, "PATCH /admin/questions/:id error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/questions/:id/archive", requireAdmin, async (req: any, res) => {
  try {
    const archived = await archiveQuestion(req.params.id);
    res.json(archived);
  } catch (err) {
    if (err instanceof Error && err.message === "Question not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    logger.error({ err }, "POST /admin/questions/:id/archive error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
