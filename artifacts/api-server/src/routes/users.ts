import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { checkPremiumEntitlement } from "./entitlement";

const router: IRouter = Router();

const CHOOSER_DAILY_LIMIT = 3;

function makeId(): string {
  return randomBytes(8).toString("hex");
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function midnightUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

// POST /api/users — create or update session user
router.post("/users", async (req, res) => {
  const { name, role, personalityVector } = req.body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    !["chooser", "suitor"].includes(role) ||
    !Array.isArray(personalityVector) ||
    personalityVector.length !== 7 ||
    personalityVector.some((v: unknown) => typeof v !== "number")
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const trimmedName = name.trim();
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  const today = todayUtc();

  if (clerkUserId) {
    try {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.clerkId, clerkUserId),
      });

      // ── Banned user check ──────────────────────────────────────────────────
      if (existing?.isBanned) {
        logger.warn({ userId: existing.id }, "Banned user attempted to start session");
        res.status(403).json({ error: "Your account has been suspended." });
        return;
      }

      if (existing) {
        // ── Cooldown check (chooser only) ──────────────────────────────────
        if (role === "chooser") {
          const sessionsToday =
            existing.chooserLastSessionDate === today
              ? (existing.chooserSessionsToday ?? 0)
              : 0;

          if (sessionsToday >= CHOOSER_DAILY_LIMIT) {
            // Premium subscribers bypass the daily limit
            const isPremium = await checkPremiumEntitlement(clerkUserId);

            if (!isPremium) {
              logger.info({ userId: existing.id, sessionsToday, limit: CHOOSER_DAILY_LIMIT }, "Chooser daily limit reached");
              res.status(200).json({
                id: existing.id,
                name: existing.name,
                role: existing.role ?? "chooser",
                status: existing.status,
                createdAt: existing.createdAt.toISOString(),
                cooldown: true,
                cooldownEndsAt: midnightUtc(),
                sessionsToday,
                chooserDailyLimit: CHOOSER_DAILY_LIMIT,
              });
              return;
            }

            logger.info({ userId: existing.id, sessionsToday }, "Premium user bypassing chooser daily limit");
          }

          await db.update(usersTable).set({
            name: trimmedName,
            role: "chooser",
            personalityVector,
            status: "looking",
            chooserSessionsToday: sessionsToday + 1,
            chooserLastSessionDate: today,
          }).where(eq(usersTable.clerkId, clerkUserId));
        } else {
          await db.update(usersTable).set({
            name: trimmedName,
            role: "suitor",
            personalityVector,
            status: "looking",
          }).where(eq(usersTable.clerkId, clerkUserId));
        }

        res.status(201).json({
          id: existing.id,
          name: trimmedName,
          role,
          status: "looking",
          createdAt: existing.createdAt.toISOString(),
        });
        return;
      }

      // ── First-time Clerk user ────────────────────────────────────────────
      const id = clerkUserId;
      await db.insert(usersTable).values({
        id,
        clerkId: clerkUserId,
        name: trimmedName,
        role: role as "chooser" | "suitor",
        personalityVector,
        status: "looking",
        chooserSessionsToday: role === "chooser" ? 1 : 0,
        chooserLastSessionDate: role === "chooser" ? today : null,
      });

      res.status(201).json({
        id,
        name: trimmedName,
        role,
        status: "looking",
        createdAt: new Date().toISOString(),
      });
      return;
    } catch (err) {
      logger.error({ err }, "POST /users clerk upsert failed, falling back to session user");
    }
  }

  // ── Anonymous session user ────────────────────────────────────────────────
  const id = makeId();
  await db.insert(usersTable).values({
    id,
    name: trimmedName,
    role: role as "chooser" | "suitor",
    personalityVector,
    status: "looking",
    chooserSessionsToday: role === "chooser" ? 1 : 0,
    chooserLastSessionDate: role === "chooser" ? today : null,
  });

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  res.status(201).json({
    id: user!.id,
    name: user!.name,
    role: user!.role,
    status: user!.status,
    createdAt: user!.createdAt.toISOString(),
  });
});

router.get("/users/looking", async (req, res) => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const users = await db.query.usersTable.findMany({
    where: and(eq(usersTable.status, "looking"), eq(usersTable.role, "suitor")),
  });

  // Do not expose stable internal user IDs to callers — the pool count is
  // sufficient for UI purposes; full identity is only needed server-side.
  res.json(
    users.map((u) => ({
      name: u.name,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
    })),
  );
});

router.put("/users/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["looking", "matched", "in_room"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  // Require the caller to be authenticated and own this user record.
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.clerkId !== auth.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.update(usersTable).set({ status }).where(eq(usersTable.id, id));

  res.json({
    id: user.id,
    name: user.name,
    role: user.role,
    status,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
