import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const requireAuth = (req: any, res: any, next: any) => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = userId;
  next();
};

// Get or create local user from Clerk identity (JIT provisioning)
async function getOrCreateUser(clerkUserId: string, email?: string, name?: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId));
  if (existing) return existing;

  const [created] = await db
    .insert(usersTable)
    .values({
      id: clerkUserId,
      clerkId: clerkUserId,
      email: email ?? null,
      name: name ?? "Anonymous",
    })
    .returning();
  return created;
}

// GET /api/stripe/me — current user profile + subscription info
router.get("/stripe/me", requireAuth, async (req: any, res) => {
  try {
    const auth = getAuth(req);
    const user = await getOrCreateUser(req.clerkUserId, auth?.sessionClaims?.email as string | undefined, auth?.sessionClaims?.name as string | undefined);

    let subscription = null;
    if (user.stripeSubscriptionId) {
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${user.stripeSubscriptionId} LIMIT 1`
      );
      subscription = result.rows[0] ?? null;
    }

    res.json({ user, subscription });
  } catch (err) {
    logger.error({ err }, "GET /stripe/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stripe/plans — list Suitor + Chooser plans
router.get("/stripe/plans", async (_req, res) => {
  try {
    // Try synced DB first
    const result = await db.execute(sql`
      SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.metadata AS product_metadata,
        pr.id AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
        AND (p.name = 'Suitor Plan' OR p.name = 'Chooser Plan')
      ORDER BY pr.unit_amount ASC
    `);

    if (result.rows.length > 0) {
      res.json({ plans: result.rows });
      return;
    }

    // Fallback: fetch directly from Stripe API (used before webhook sync completes)
    const stripe = await getUncachableStripeClient();
    const [suitorSearch, chooserSearch] = await Promise.all([
      stripe.products.search({ query: "name:'Suitor Plan' AND active:'true'" }),
      stripe.products.search({ query: "name:'Chooser Plan' AND active:'true'" }),
    ]);

    const plans = [];
    for (const product of [...suitorSearch.data, ...chooserSearch.data]) {
      const prices = await stripe.prices.list({ product: product.id, active: true, limit: 1 });
      if (prices.data.length > 0) {
        const price = prices.data[0];
        plans.push({
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_metadata: product.metadata,
          price_id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
        });
      }
    }
    plans.sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0));
    res.json({ plans });
  } catch (err) {
    logger.error({ err }, "GET /stripe/plans error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/checkout — create Stripe Checkout session
router.post("/stripe/checkout", requireAuth, async (req: any, res) => {
  try {
    const { priceId } = req.body;
    if (!priceId) {
      res.status(400).json({ error: "priceId is required" });
      return;
    }

    const auth = getAuth(req);
    const user = await getOrCreateUser(
      req.clerkUserId,
      auth?.sessionClaims?.email as string | undefined,
      auth?.sessionClaims?.name as string | undefined,
    );

    const stripe = await getUncachableStripeClient();

    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name,
        metadata: { clerkId: req.clerkUserId },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.clerkId, req.clerkUserId));
    }

    const host = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${host}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${host}/subscribe`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "POST /stripe/checkout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/portal — billing portal
router.post("/stripe/portal", requireAuth, async (req: any, res) => {
  try {
    const user = await getOrCreateUser(req.clerkUserId);
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No billing account found" });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const host = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${host}/`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "POST /stripe/portal error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
