import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, usersTable, participantsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getIo } from "../socket";
import { buildRoomResponse } from "../lib/roomUtils";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = auth.userId;
  next();
};

const REVENUECAT_ENTITLEMENT = "premium";

/**
 * Check a subscriber's premium entitlement via RevenueCat REST API (v1).
 * Uses the server-side secret key (REVENUECAT_SECRET_KEY) to query the
 * subscriber record for the authenticated user's Clerk ID (which is also
 * the RevenueCat app user ID).
 */
export async function checkPremiumEntitlement(appUserId: string): Promise<boolean> {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    logger.warn("REVENUECAT_SECRET_KEY not set — premium entitlement check skipped");
    return false;
  }

  try {
    const resp = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5_000),
      },
    );

    if (!resp.ok) {
      logger.warn({ status: resp.status, appUserId }, "RevenueCat subscriber fetch failed");
      return false;
    }

    const data = (await resp.json()) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date: string | null }>;
      };
    };

    const entitlement = data.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT];
    if (!entitlement) return false;

    // expires_date null = lifetime, otherwise check it hasn't expired
    if (entitlement.expires_date === null) return true;
    return new Date(entitlement.expires_date) > new Date();
  } catch (err) {
    logger.error({ err, appUserId }, "RevenueCat entitlement check error");
    return false;
  }
}

/**
 * Check premium entitlement via RevenueCat and persist the result to the
 * user record in the DB so it acts as a short-lived cache and a stable source
 * of truth for participant-level flags (participants.is_premium).
 *
 * Pass the Clerk user ID (= RevenueCat app_user_id) and the DB user ID.
 * If the DB user ID is not known, only the remote check runs (no write-through).
 */
export async function checkAndCachePremiumEntitlement(
  clerkId: string,
  dbUserId?: string,
): Promise<boolean> {
  const isPremium = await checkPremiumEntitlement(clerkId);

  if (dbUserId) {
    try {
      await db
        .update(usersTable)
        .set({ isPremium })
        .where(eq(usersTable.id, dbUserId));
    } catch (err) {
      logger.error({ err, dbUserId }, "Failed to cache premium flag on user record");
    }
  }

  return isPremium;
}

/**
 * Look up the cached isPremium value from the user record by Clerk ID.
 * Falls back to false if the user is not found.
 * This is used in room/participant flows where a live RevenueCat call would
 * add too much latency (e.g. join routes that don't already batch-check).
 */
export async function getCachedPremiumByClerkId(clerkId: string): Promise<boolean> {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
      columns: { isPremium: true },
    });
    return user?.isPremium ?? false;
  } catch (err) {
    logger.error({ err, clerkId }, "Failed to read cached premium flag");
    return false;
  }
}

// GET /api/entitlement/premium — client-callable endpoint
// Checks RevenueCat and writes the result back to the user record (write-through cache).
router.get("/entitlement/premium", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
      columns: { id: true },
    });
    const isPremium = await checkAndCachePremiumEntitlement(
      req.clerkUserId,
      user?.id,
    );
    res.json({ isPremium });
  } catch (err) {
    logger.error({ err }, "GET /entitlement/premium error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/entitlement/premium/sync — re-check premium status and propagate
// to any active participant rows, then emit room_updated for each affected room.
// Called by the mobile client immediately after a successful purchase or restore.
router.post("/entitlement/premium/sync", requireAuth, async (req: any, res) => {
  try {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, req.clerkUserId),
      columns: { id: true },
    });

    const isPremium = await checkAndCachePremiumEntitlement(
      req.clerkUserId,
      user?.id,
    );

    let roomsUpdated = 0;

    if (user?.id) {
      const affected = await db.query.participantsTable.findMany({
        where: eq(participantsTable.userId, user.id),
        columns: { id: true, roomId: true, isPremium: true },
      });

      const staleParticipants = affected.filter((p) => p.isPremium !== isPremium);

      if (staleParticipants.length > 0) {
        await db
          .update(participantsTable)
          .set({ isPremium })
          .where(eq(participantsTable.userId, user.id));

        const roomIds = [...new Set(staleParticipants.map((p) => p.roomId))];

        const io = getIo();
        for (const roomId of roomIds) {
          const roomData = await buildRoomResponse(roomId);
          if (roomData) {
            io.to(roomId).emit("room_updated", roomData);
            roomsUpdated++;
          }
        }

        logger.info(
          { clerkUserId: req.clerkUserId, isPremium, roomsUpdated },
          "Premium entitlement synced to participants",
        );
      }
    }

    res.json({ isPremium, roomsUpdated });
  } catch (err) {
    logger.error({ err }, "POST /entitlement/premium/sync error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
