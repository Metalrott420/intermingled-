import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq, or, and, desc, gt } from "drizzle-orm";
import { db, usersTable, matchesTable, directMessagesTable, matchReadStatesTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger";
import { getMatchPresenceSnapshot, getIo } from "../socket";

const router: IRouter = Router();

function makeId() {
  return randomBytes(8).toString("hex");
}

async function resolveCurrentUser(clerkUserId: string) {
  return db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, clerkUserId) });
}

function isMatchParticipant(match: { chooserUserId: string; suitorUserId: string }, userId: string) {
  return match.chooserUserId === userId || match.suitorUserId === userId;
}

const ReadReceiptBody = {
  parse(input: any) {
    if (!input || typeof input !== "object") return { lastReadAt: null as string | null };
    const value = input.lastReadAt;
    if (value === undefined || value === null) return { lastReadAt: null as string | null };
    if (typeof value !== "string") throw new Error("lastReadAt must be an ISO datetime string");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error("lastReadAt must be an ISO datetime string");
    return { lastReadAt: date.toISOString() };
  },
};

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = auth.userId;
  next();
};

// GET /api/rooms/:roomId/match — look up the match for a room
// Restricted to the two matched users only.
router.get("/rooms/:roomId/match", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.roomId, req.params.roomId),
    });
    if (!match) {
      res.json({ match: null });
      return;
    }

    // Only the two matched users may read this record
    if (match.chooserUserId !== user.id && match.suitorUserId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    res.json({
      match: {
        id: match.id,
        roomId: match.roomId,
        chooserUserId: match.chooserUserId,
        suitorUserId: match.suitorUserId,
        chooserName: match.chooserName,
        suitorName: match.suitorName,
        createdAt: match.createdAt.toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches — list all matches for the current user
router.get("/matches", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.json({ matches: [] });
      return;
    }

    const matches = await db.query.matchesTable.findMany({
      where: or(
        eq(matchesTable.chooserUserId, user.id),
        eq(matchesTable.suitorUserId, user.id),
      ),
      orderBy: (m, { desc }) => [desc(m.createdAt)],
    });

    // Enrich with last message
    const enriched = await Promise.all(
      matches.map(async (match) => {
        const lastMsg = await db.query.directMessagesTable.findFirst({
          where: eq(directMessagesTable.matchId, match.id),
          orderBy: (m, { desc }) => [desc(m.createdAt)],
        });
        const otherId =
          match.chooserUserId === user.id ? match.suitorUserId : match.chooserUserId;
        const otherName =
          match.chooserUserId === user.id ? match.suitorName : match.chooserName;
        const otherUser = await db.query.usersTable.findFirst({
          where: eq(usersTable.id, otherId),
        });
        return {
          ...match,
          otherUserId: otherId,
          otherName,
          otherPhotos: otherUser?.photos ?? [],
          lastMessage: lastMsg
            ? { content: lastMsg.content, createdAt: lastMsg.createdAt.toISOString(), senderName: lastMsg.senderName }
            : null,
        };
      }),
    );

    res.json({ matches: enriched });
  } catch (err) {
    logger.error({ err }, "GET /matches error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:matchId/messages — get messages for a match
router.get("/matches/:matchId/messages", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.id, req.params.matchId),
    });
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    // Only participants in the match can read messages
    if (match.chooserUserId !== user.id && match.suitorUserId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const messages = await db.query.directMessagesTable.findMany({
      where: eq(directMessagesTable.matchId, match.id),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    res.json({ messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })) });
  } catch (err) {
    logger.error({ err }, "GET /matches/:matchId/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:matchId/state — private chat reconnect and lifecycle metadata
router.get("/matches/:matchId/state", requireAuth, async (req: any, res) => {
  try {
    const user = await resolveCurrentUser(req.clerkUserId);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.id, req.params.matchId),
    });
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (!isMatchParticipant(match, user.id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const readState = await db.query.matchReadStatesTable.findFirst({
      where: and(eq(matchReadStatesTable.matchId, match.id), eq(matchReadStatesTable.userId, user.id)),
    });

    const unreadMessages = await db.query.directMessagesTable.findMany({
      where: and(
        eq(directMessagesTable.matchId, match.id),
        readState
          ? gt(directMessagesTable.createdAt, readState.lastReadAt)
          : undefined,
      ),
      orderBy: (table, helpers) => [helpers.asc(table.createdAt)],
    });
    const unreadCount = unreadMessages.filter((message) => message.senderId !== user.id).length;
    const presence = getMatchPresenceSnapshot(match.id, user.id);

    res.json({
      matchId: match.id,
      unreadCount,
      lastReadAt: readState?.lastReadAt?.toISOString() ?? null,
      canResume: true,
      serverTime: new Date().toISOString(),
      presence,
    });
  } catch (err) {
    logger.error({ err }, "GET /matches/:matchId/state error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/matches/:matchId/read — update read cursor for read receipts
router.post("/matches/:matchId/read", requireAuth, async (req: any, res) => {
  try {
    const user = await resolveCurrentUser(req.clerkUserId);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.id, req.params.matchId),
    });
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (!isMatchParticipant(match, user.id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    let body: { lastReadAt: string | null };
    try {
      body = ReadReceiptBody.parse(req.body ?? {});
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid body" });
      return;
    }

    const lastReadAt = body.lastReadAt ? new Date(body.lastReadAt) : new Date();
    const now = new Date();

    const existing = await db.query.matchReadStatesTable.findFirst({
      where: and(eq(matchReadStatesTable.matchId, match.id), eq(matchReadStatesTable.userId, user.id)),
    });

    if (existing) {
      await db.update(matchReadStatesTable)
        .set({ lastReadAt, updatedAt: now })
        .where(eq(matchReadStatesTable.id, existing.id));
    } else {
      await db.insert(matchReadStatesTable).values({
        id: makeId(),
        matchId: match.id,
        userId: user.id,
        lastReadAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    try {
      getIo().to(`match_${match.id}`).emit("dm_read", {
        matchId: match.id,
        userId: user.id,
        lastReadAt: lastReadAt.toISOString(),
      });
    } catch {
      // Ignore socket emission failures for read cursor writes.
    }

    res.json({ ok: true, matchId: match.id, lastReadAt: lastReadAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "POST /matches/:matchId/read error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/matches/:matchId/messages — send a direct message
router.post("/matches/:matchId/messages", requireAuth, async (req: any, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "content required" });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const match = await db.query.matchesTable.findFirst({
      where: eq(matchesTable.id, req.params.matchId),
    });
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (match.chooserUserId !== user.id && match.suitorUserId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const id = makeId();
    const now = new Date();
    const [msg] = await db
      .insert(directMessagesTable)
      .values({
        id,
        matchId: match.id,
        senderId: user.id,
        senderName: user.name,
        content: content.trim(),
        createdAt: now,
      })
      .returning();

    // Emit via socket to the match room
    try {
      getIo().to(`match_${match.id}`).emit("dm_received", {
        ...msg,
        createdAt: now.toISOString(),
      });
    } catch {}

    res.status(201).json({ ...msg, createdAt: now.toISOString() });
  } catch (err) {
    logger.error({ err }, "POST /matches/:matchId/messages error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
