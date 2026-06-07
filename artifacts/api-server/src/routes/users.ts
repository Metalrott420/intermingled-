import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db, usersTable } from "@workspace/db";

const router: IRouter = Router();

function makeId(): string {
  return randomBytes(8).toString("hex");
}

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

  const id = makeId();
  await db.insert(usersTable).values({
    id,
    name: name.trim(),
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
