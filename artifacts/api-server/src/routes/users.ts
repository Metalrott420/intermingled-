import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function makeId(): string {
  return randomBytes(8).toString("hex");
}

// POST /api/users — create or update session user
// If the caller is Clerk-authenticated, we reuse their existing user record so that:
//   1. matches created during speed-dating use the same ID as the inbox/profile
//   2. subsequent `GET /api/matches` finds those matches immediately
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

  // If signed-in, upsert on the Clerk user record so session and profile share one ID
  if (clerkUserId) {
    try {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.clerkId, clerkUserId),
      });

      if (existing) {
        // Update with fresh session data
        await db.update(usersTable).set({
          name: trimmedName,
          role: role as "chooser" | "suitor",
          personalityVector,
          status: "looking",
        }).where(eq(usersTable.clerkId, clerkUserId));

        res.status(201).json({
          id: existing.id,
          name: trimmedName,
          role,
          status: "looking",
          createdAt: existing.createdAt.toISOString(),
        });
        return;
      }

      // Create Clerk-linked user if not yet in DB
      const id = clerkUserId;
      await db.insert(usersTable).values({
        id,
        clerkId: clerkUserId,
        name: trimmedName,
        role: role as "chooser" | "suitor",
        personalityVector,
        status: "looking",
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
      // Fall through to anonymous session user
    }
  }

  // Anonymous session user
  const id = makeId();
  await db.insert(usersTable).values({
    id,
    name: trimmedName,
    role: role as "chooser" | "suitor",
    personalityVector,
    status: "looking",
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

router.get("/users/looking", async (_req, res) => {
  const users = await db.query.usersTable.findMany({
    where: and(eq(usersTable.status, "looking"), eq(usersTable.role, "suitor")),
  });

  res.json(
    users.map((u) => ({
      id: u.id,
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

  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, id) });
  if (!user) {
    res.status(404).json({ error: "User not found" });
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
