import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  if (!auth?.userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = auth.userId;
  next();
};

function buildReturnUrl(req: any): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? (req.headers["host"] as string) ?? "";
  return `${proto}://${host}/verify-age/result`;
}

function calculateAge(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age;
}

// POST /api/identity/start — create a Stripe Identity verification session
router.post("/identity/start", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkUserId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.ageVerified) {
      res.json({ alreadyVerified: true });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const returnUrl = buildReturnUrl(req);

    const session = await (stripe.identity.verificationSessions as any).create({
      type: "document",
      options: {
        document: {
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      return_url: returnUrl,
      metadata: { userId: user.id },
    });

    await db
      .update(usersTable)
      .set({ identitySessionId: session.id })
      .where(eq(usersTable.id, user.id));

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    logger.error({ err }, "POST /identity/start error");
    res.status(500).json({ error: "Failed to start verification. Please try again." });
  }
});

// GET /api/identity/status — check current user's age verification status
router.get("/identity/status", requireAuth, async (req: any, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, req.clerkUserId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.ageVerified) {
      res.json({ verified: true, status: "verified" });
      return;
    }

    if (!user.identitySessionId) {
      res.json({ verified: false, status: "not_started" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const session = await (stripe.identity.verificationSessions as any).retrieve(
      user.identitySessionId,
      { expand: ["verified_outputs"] }
    );

    if (session.status === "verified") {
      const dob = session.verified_outputs?.dob;

      if (!dob?.year || !dob?.month || !dob?.day) {
        // DOB must be present in verified_outputs to confirm the user's age.
        // A missing DOB cannot be treated as proof of eligibility — deny access.
        logger.warn(
          { sessionId: user.identitySessionId },
          "Stripe Identity session verified but DOB absent from verified_outputs; denying age verification"
        );
        res.json({
          verified: false,
          status: "failed",
          message: "Age could not be confirmed from your identity document. Please try again.",
        });
        return;
      }

      const age = calculateAge(dob.year, dob.month, dob.day);
      if (age >= 18) {
        await db
          .update(usersTable)
          .set({ ageVerified: true })
          .where(eq(usersTable.id, user.id));
        res.json({ verified: true, status: "verified" });
        return;
      }

      res.json({
        verified: false,
        status: "underage",
        message: "You must be 18 or older to use Intermingled.",
      });
      return;
    }

    const messageMap: Record<string, string> = {
      requires_input: "Verification was not completed. Please try again.",
      canceled: "Verification was canceled. Please try again.",
    };

    res.json({
      verified: false,
      status: session.status === "requires_input" ? "failed" : session.status,
      message: messageMap[session.status],
    });
  } catch (err) {
    logger.error({ err }, "GET /identity/status error");
    res.status(500).json({ error: "Failed to check verification status." });
  }
});

export default router;
