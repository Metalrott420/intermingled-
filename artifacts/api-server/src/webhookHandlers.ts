import { getUncachableStripeClient } from "./stripeClient";
import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { logger } from "./lib/logger";

const processedWebhookEvents = new Set<string>();

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error("STRIPE WEBHOOK ERROR: Payload must be a Buffer.");
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = await getUncachableStripeClient();

    let event: any;
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      } catch (err: any) {
        logger.error({ err }, "Stripe webhook signature verification failed");
        throw new Error(`Webhook signature verification failed: ${err.message}`);
      }
    } else {
      logger.warn("STRIPE_WEBHOOK_SECRET not configured — parsing raw webhook payload without signature verification in non-strict mode");
      event = JSON.parse(payload.toString("utf8"));
    }

    // Idempotency & Replay Protection
    if (event.id && processedWebhookEvents.has(event.id)) {
      logger.info({ eventId: event.id }, "Duplicate webhook event ignored");
      return;
    }
    if (event.id) {
      processedWebhookEvents.add(event.id);
      // Limit memory set size to prevent leak
      if (processedWebhookEvents.size > 1000) {
        const oldest = Array.from(processedWebhookEvents)[0];
        if (oldest) processedWebhookEvents.delete(oldest);
      }
    }

    logger.info({ eventType: event.type, eventId: event.id }, "Processing Stripe Webhook Event");

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.userId || session.client_reference_id;

        if (userId) {
          await db
            .update(usersTable)
            .set({
              isPremium: true,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            })
            .where(or(eq(usersTable.id, userId), eq(usersTable.clerkId, userId)));
          logger.info({ userId, customerId, subscriptionId }, "User upgraded to Premium via Checkout");
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer as string;
        const status = sub.status; // 'active', 'past_due', 'canceled', etc.
        const isActive = status === "active" || status === "trialing";

        await db
          .update(usersTable)
          .set({
            isPremium: isActive,
            stripeSubscriptionId: sub.id,
          })
          .where(eq(usersTable.stripeCustomerId, customerId));

        logger.info({ customerId, status, isActive }, "Subscription status synced to DB");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer as string;

        await db
          .update(usersTable)
          .set({
            isPremium: false,
            isOrganizer: false,
            stripeSubscriptionId: null,
          })
          .where(eq(usersTable.stripeCustomerId, customerId));

        logger.info({ customerId }, "Subscription deleted — Premium access revoked");
        break;
      }

      default:
        logger.info({ type: event.type }, "Unhandled Stripe webhook event type");
    }
  }
}
