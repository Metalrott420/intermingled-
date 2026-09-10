/**
 * SubscriptionService owns premium entitlement lookup and caching behavior.
 *
 * It is responsible for talking to RevenueCat and storing a short-lived premium
 * flag on the user record.
 *
 * It must never own pricing, checkout flows, or feature gating directly.
 * Those belong to payment and rule services.
 */
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const REVENUECAT_ENTITLEMENT = "premium";

/**
 * Checks whether a RevenueCat app user ID currently holds the premium entitlement.
 *
 * @param appUserId - Clerk user ID used as the RevenueCat app user identifier
 * @returns true when the user is premium
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

    if (entitlement.expires_date === null) return true;
    return new Date(entitlement.expires_date) > new Date();
  } catch (err) {
    logger.error({ err, appUserId }, "RevenueCat entitlement check error");
    return false;
  }
}

/**
 * Checks premium entitlement via RevenueCat and optionally caches the result
 * on the local DB user record.
 *
 * @param clerkId - Clerk user ID used by RevenueCat
 * @param dbUserId - optional internal DB user ID for caching
 * @returns true when the user is premium
 */
export async function checkAndCachePremiumEntitlement(
  clerkId: string,
  dbUserId?: string,
): Promise<boolean> {
  const isPremium = await checkPremiumEntitlement(clerkId);

  if (dbUserId) {
    try {
      await db.update(usersTable).set({ isPremium }).where(eq(usersTable.id, dbUserId));
    } catch (err) {
      logger.error({ err, dbUserId }, "Failed to cache premium flag on user record");
    }
  }

  return isPremium;
}

/**
 * Reads the cached premium flag from the user record if available.
 *
 * @param clerkId - Clerk user ID to look up
 * @returns cached premium boolean or false when unavailable
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
