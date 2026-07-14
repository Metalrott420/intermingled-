import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { logger } from "../lib/logger";

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

// GET /api/entitlement/premium — client-callable endpoint
router.get("/entitlement/premium", requireAuth, async (req: any, res) => {
  try {
    const isPremium = await checkPremiumEntitlement(req.clerkUserId);
    res.json({ isPremium });
  } catch (err) {
    logger.error({ err }, "GET /entitlement/premium error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
