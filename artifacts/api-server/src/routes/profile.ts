import { Router, type IRouter } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";
import { z } from "zod/v4";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Emails that get admin rights automatically on first sign-in (case-insensitive)
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "metalrott.7@gmail.com").toLowerCase().split(",").map((e) => e.trim())
);

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

const requireNotBanned = async (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) { next(); return; }
  try {
    const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.clerkId, auth.userId));
    if (user?.isBanned) {
      res.status(403).json({ error: "Your account has been suspended." });
      return;
    }
  } catch { /* non-blocking — if DB fails, allow through */ }
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

async function getOrCreateUser(clerkUserId: string, sessionEmail?: string, sessionName?: string) {
  // Fetch email from Clerk backend if session claims didn't have it
  let email = sessionEmail ?? null;
  try {
    if (!email) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      email = clerkUser.emailAddresses?.[0]?.emailAddress ?? null;
    }
  } catch (err) {
    logger.warn({ err }, "getOrCreateUser: could not fetch Clerk user email");
  }

  const isAdminEmail = email ? ADMIN_EMAILS.has(email.toLowerCase()) : false;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId));

  if (existing) {
    // Sync email and auto-promote admin if needed
    const needsUpdate = (!existing.email && email) || (isAdminEmail && !existing.isAdmin);
    if (needsUpdate) {
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (!existing.email && email) updates.email = email;
      if (isAdminEmail && !existing.isAdmin) updates.isAdmin = true;
      await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, clerkUserId));
      return { ...existing, ...updates };
    }
    return existing;
  }

  // First-time user — create record
  const [created] = await db
    .insert(usersTable)
    .values({
      id: clerkUserId,
      clerkId: clerkUserId,
      email: email ?? null,
      name: sessionName ?? "Anonymous",
      isAdmin: isAdminEmail,
    })
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

// GET /api/profile/:userId — view another user's public profile (requires auth)
// dateOfBirth is PII and must not appear in the public response.
router.get("/profile/:userId", requireAuth, async (req, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, req.params.userId),
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Expose computed age only — never the raw date of birth — to limit
    // personal-data exposure and reduce identity-theft risk.
    const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;
    res.json({
      id: user.id,
      name: user.name,
      bio: user.bio,
      age,
      photos: user.photos ?? [],
      role: user.role,
    });
  } catch (err) {
    logger.error({ err }, "GET /profile/:userId error");
    res.status(500).json({ error: "Internal server error" });
  }
});

const ProfilePromptSchema = z.object({
  question: z.string().max(200),
  answer: z.string().max(300),
});

const GENDER_VALUES = ["man", "woman", "nonbinary", "other"] as const;
const SHOW_ME_VALUES = ["men", "women", "everyone"] as const;

const UpdateProfileBody = z.object({
  name: z.string().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  photos: z.array(z.string()).max(12).optional(),
  profilePrompts: z.array(ProfilePromptSchema).max(3).optional(),
  gender: z.enum(GENDER_VALUES).optional(),
  showMeGender: z.enum(SHOW_ME_VALUES).optional(),
});

// PUT /api/profile/me — update own profile
router.put("/profile/me", requireAuth, requireNotBanned, async (req: any, res) => {
  try {
    const parsed = UpdateProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
      return;
    }
    const { name, bio, dateOfBirth, photos, profilePrompts, gender, showMeGender } = parsed.data;

    if (dateOfBirth) {
      const age = calculateAge(dateOfBirth);
      if (age < 18) {
        res.status(403).json({ error: "You must be 18 or older to use Intermingled." });
        return;
      }
    }

    // Reject any photo path that was not uploaded by this user.
    if (photos !== undefined) {
      const ownedPrefix = `/objects/uploads/${req.clerkUserId}/`;
      const hasUnowned = photos.some((p) => !p.startsWith(ownedPrefix));
      if (hasUnowned) {
        res.status(403).json({ error: "You can only attach photos you uploaded yourself." });
        return;
      }
    }

    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (photos !== undefined) updateData.photos = photos;
    if (profilePrompts !== undefined) updateData.profilePrompts = profilePrompts;
    if (gender !== undefined) updateData.gender = gender;
    if (showMeGender !== undefined) updateData.showMeGender = showMeGender;

    await db.update(usersTable).set(updateData).where(eq(usersTable.clerkId, req.clerkUserId));

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
router.post("/profile/me/photos/upload-url", requireAuth, requireNotBanned, async (req: any, res) => {
  try {
    const { name, size, contentType } = req.body;
    if (!name || !size || !contentType) {
      res.status(400).json({ error: "name, size, contentType required" });
      return;
    }
    // Strict allowlist — image/svg+xml is excluded because SVG can carry inline
    // script that executes same-origin when served back from the app's domain.
    const ALLOWED_PHOTO_TYPES = new Set([
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
    ]);
    if (!ALLOWED_PHOTO_TYPES.has(contentType)) {
      res.status(400).json({ error: "Only JPEG, PNG, GIF, WebP, or AVIF images are allowed." });
      return;
    }
    if (size > 10 * 1024 * 1024) {
      res.status(400).json({ error: "File too large (max 10MB)" });
      return;
    }

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, req.clerkUserId) });
    const currentPhotos = user?.photos ?? [];
    if (currentPhotos.length >= 12) {
      res.status(400).json({ error: "Maximum 12 photos allowed" });
      return;
    }

    // Scope the upload path under the authenticated user's ID so that
    // ownership can be verified when the path is later attached to a profile.
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(req.clerkUserId);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath });
  } catch (err) {
    logger.error({ err }, "POST /profile/me/photos/upload-url error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/profile/me/photos — add a photo path after upload
router.post("/profile/me/photos", requireAuth, requireNotBanned, async (req: any, res) => {
  try {
    const { objectPath } = req.body;
    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "objectPath required" });
      return;
    }

    // Verify the object path was issued to this user (scoped under their ID).
    if (!objectPath.startsWith(`/objects/uploads/${req.clerkUserId}/`)) {
      res.status(403).json({ error: "You can only attach photos you uploaded yourself." });
      return;
    }

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, req.clerkUserId) });
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
    await db.update(usersTable).set({ photos: newPhotos }).where(eq(usersTable.clerkId, req.clerkUserId));
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

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.clerkId, req.clerkUserId) });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newPhotos = (user.photos ?? []).filter((p) => p !== objectPath);
    await db.update(usersTable).set({ photos: newPhotos }).where(eq(usersTable.clerkId, req.clerkUserId));
    res.json({ photos: newPhotos });
  } catch (err) {
    logger.error({ err }, "DELETE /profile/me/photos error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/push-token — register Expo push token
router.post("/users/push-token", requireAuth, async (req: any, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      res.status(400).json({ error: "token required" });
      return;
    }
    await db.update(usersTable).set({ expoPushToken: token }).where(eq(usersTable.clerkId, req.clerkUserId));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /users/push-token error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
