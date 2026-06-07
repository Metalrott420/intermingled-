import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { z } from "zod/v4";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkUserId = userId;
  next();
};

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

async function getOrCreateUser(clerkUserId: string, email?: string, name?: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId));
  if (existing) return existing;
  const [created] = await db
    .insert(usersTable)
    .values({ id: clerkUserId, clerkId: clerkUserId, email: email ?? null, name: name ?? "Anonymous" })
    .returning();
  return created;
}

// GET /api/profile/me — own full profile
router.get("/profile/me", requireAuth, async (req: any, res) => {
  try {
    const auth = getAuth(req);
    const user = await getOrCreateUser(
      req.clerkUserId,
      auth?.sessionClaims?.email as string | undefined,
      auth?.sessionClaims?.name as string | undefined,
    );
    res.json(user);
  } catch (err) {
    logger.error({ err }, "GET /profile/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/profile/:userId — view another user's public profile
router.get("/profile/:userId", async (req, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.userId),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Return public fields only
    res.json({
      id: user.id,
      name: user.name,
      bio: user.bio,
      dateOfBirth: user.dateOfBirth,
      photos: user.photos ?? [],
      role: user.role,
    });
  } catch (err) {
    logger.error({ err }, "GET /profile/:userId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const UpdateProfileBody = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  photos: z.array(z.string()).max(12).optional(),
});

// PUT /api/profile/me — update own profile
router.put("/profile/me", requireAuth, async (req: any, res) => {
  try {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }
    const { name, bio, dateOfBirth, photos } = parsed.data;

    // Enforce 18+ if dateOfBirth is being set
    if (dateOfBirth) {
      const age = calculateAge(dateOfBirth);
      if (age < 18) {
        res.status(403).json({ error: "You must be 18 or older to use Intermingled." });
        return;
      }
    }

    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (photos !== undefined) updateData.photos = photos;

    await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.clerkId, req.clerkUserId));

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    res.json(user);
  } catch (err) {
    logger.error({ err }, "PUT /profile/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile/me/photos/upload-url — get presigned URL for photo upload
router.post("/profile/me/photos/upload-url", requireAuth, async (req: any, res) => {
  try {
    const { name, size, contentType } = req.body;
    if (!name || !size || !contentType) {
      res.status(400).json({ error: "name, size, contentType required" });
      return;
    }
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image files are allowed" });
      return;
    }
    if (size > 10 * 1024 * 1024) {
      res.status(400).json({ error: "File too large (max 10MB)" });
      return;
    }

    // Check current photo count
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    const currentPhotos = user?.photos ?? [];
    if (currentPhotos.length >= 12) {
      res.status(400).json({ error: "Maximum 12 photos allowed" });
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath });
  } catch (err) {
    logger.error({ err }, "POST /profile/me/photos/upload-url error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile/me/photos — add a photo path after upload
router.post("/profile/me/photos", requireAuth, async (req: any, res) => {
  try {
    const { objectPath } = req.body;
    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "objectPath required" });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const currentPhotos = user.photos ?? [];
    if (currentPhotos.length >= 12) {
      res.status(400).json({ error: "Maximum 12 photos allowed" });
      return;
    }

    const newPhotos = [...currentPhotos, objectPath];
    await db
      .update(usersTable)
      .set({ photos: newPhotos })
      .where(eq(usersTable.clerkId, req.clerkUserId));

    res.json({ photos: newPhotos });
  } catch (err) {
    logger.error({ err }, "POST /profile/me/photos error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/profile/me/photos — remove a photo
router.delete("/profile/me/photos", requireAuth, async (req: any, res) => {
  try {
    const { objectPath } = req.body;
    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "objectPath required" });
      return;
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newPhotos = (user.photos ?? []).filter((p) => p !== objectPath);
    await db
      .update(usersTable)
      .set({ photos: newPhotos })
      .where(eq(usersTable.clerkId, req.clerkUserId));

    res.json({ photos: newPhotos });
  } catch (err) {
    logger.error({ err }, "DELETE /profile/me/photos error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
