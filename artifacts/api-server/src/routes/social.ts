import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, and, sql } from "drizzle-orm";
import { db, usersTable, blocksTable, reportsTable, likesTable, groupMessagesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getIo } from "../socket";
import { randomBytes } from "crypto";

const genId = () => randomBytes(8).toString("hex");

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  req.clerkUserId = auth.userId;
  next();
};

async function getDbUserId(clerkUserId: string): Promise<string | null> {
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, clerkUserId));
  return user?.id ?? null;
}

// ── Block ────────────────────────────────────────────────────────────────────
router.post("/users/:id/block", requireAuth, async (req: any, res) => {
  try {
    const blockerId = await getDbUserId(req.clerkUserId);
    if (!blockerId) { res.status(404).json({ error: "User not found" }); return; }
    const blockedId = req.params.id;
    await db.insert(blocksTable).values({ blockerId, blockedId }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /users/:id/block error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id/block", requireAuth, async (req: any, res) => {
  try {
    const blockerId = await getDbUserId(req.clerkUserId);
    if (!blockerId) { res.status(404).json({ error: "User not found" }); return; }
    const blockedId = req.params.id;
    await db.delete(blocksTable).where(and(eq(blocksTable.blockerId, blockerId), eq(blocksTable.blockedId, blockedId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /users/:id/block error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Report ───────────────────────────────────────────────────────────────────
router.post("/users/:id/report", requireAuth, async (req: any, res) => {
  try {
    const reporterId = await getDbUserId(req.clerkUserId);
    if (!reporterId) { res.status(404).json({ error: "User not found" }); return; }
    const { reason, detail } = req.body;
    if (!reason) { res.status(400).json({ error: "Reason required" }); return; }
    await db.insert(reportsTable).values({
      id: genId(),
      reporterId,
      reportedId: req.params.id,
      reason,
      detail: detail ?? null,
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /users/:id/report error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Likes ────────────────────────────────────────────────────────────────────
router.post("/users/:id/like", requireAuth, async (req: any, res) => {
  try {
    const likerId = await getDbUserId(req.clerkUserId);
    if (!likerId) { res.status(404).json({ error: "User not found" }); return; }
    await db.insert(likesTable).values({ likerId, likedId: req.params.id }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /users/:id/like error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id/like", requireAuth, async (req: any, res) => {
  try {
    const likerId = await getDbUserId(req.clerkUserId);
    if (!likerId) { res.status(404).json({ error: "User not found" }); return; }
    await db.delete(likesTable).where(and(eq(likesTable.likerId, likerId), eq(likesTable.likedId, req.params.id)));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /users/:id/like error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/who-liked-me", requireAuth, async (req: any, res) => {
  try {
    const myId = await getDbUserId(req.clerkUserId);
    if (!myId) { res.status(404).json({ error: "User not found" }); return; }
    const likers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        photos: usersTable.photos,
        bio: usersTable.bio,
        likedAt: likesTable.createdAt,
      })
      .from(likesTable)
      .innerJoin(usersTable, eq(likesTable.likerId, usersTable.id))
      .where(eq(likesTable.likedId, myId))
      .orderBy(sql`${likesTable.createdAt} desc`)
      .limit(50);
    res.json({ likers });
  } catch (err) {
    logger.error({ err }, "GET /users/who-liked-me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Post-game group chat ─────────────────────────────────────────────────────
router.get("/rooms/:roomId/group-messages", async (req, res) => {
  try {
    const msgs = await db
      .select()
      .from(groupMessagesTable)
      .where(eq(groupMessagesTable.roomId, req.params.roomId))
      .orderBy(groupMessagesTable.createdAt)
      .limit(200);
    res.json({ messages: msgs });
  } catch (err) {
    logger.error({ err }, "GET /rooms/:roomId/group-messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Patterns that suggest contact info being shared
const CONTACT_INFO_PATTERNS = [
  // Phone numbers — 7+ digit sequences with optional separators
  /(\+?\d[\s\-.]?){7,}/,
  // Email addresses
  /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i,
  // Instagram / Snapchat / TikTok / Twitter handles  e.g. "my ig is @foo" or just "@foo"
  /@[a-z0-9_.]{2,}/i,
  // Common social shorthand: "ig:", "snap:", "sc:", "tt:", "fb:", "discord:"
  /\b(instagram|insta|ig|snapchat|snap|sc|tiktok|tt|facebook|fb|discord|whatsapp|wapp|wa|telegram|tg|kik|signal)\s*[:/]?\s*[a-z0-9_.]{2,}/i,
  // Explicit "find me on" / "dm me on" phrasing
  /\b(find me on|dm me on|hit me on|message me on|add me on|follow me)\b/i,
];

function containsContactInfo(text: string): boolean {
  return CONTACT_INFO_PATTERNS.some((re) => re.test(text));
}

router.post("/rooms/:roomId/group-messages", requireAuth, async (req: any, res) => {
  try {
    const senderId = await getDbUserId(req.clerkUserId);
    if (!senderId) { res.status(404).json({ error: "User not found" }); return; }
    const { content, senderName } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

    if (containsContactInfo(content.trim())) {
      res.status(422).json({
        error: "contact_info_blocked",
        message: "Contact info isn't allowed here — use your private match chat instead.",
      });
      return;
    }

    const id = genId();
    const now = new Date();
    const [msg] = await db.insert(groupMessagesTable).values({
      id,
      roomId: req.params.roomId,
      senderId,
      senderName: senderName ?? "Anonymous",
      content: content.trim(),
    }).returning();
    try { getIo().to(req.params.roomId).emit("group_message", msg); } catch { /* socket not ready */ }
    res.json({ message: msg });
  } catch (err) {
    logger.error({ err }, "POST /rooms/:roomId/group-messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
