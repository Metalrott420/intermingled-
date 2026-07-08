import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';
import { logger } from './lib/logger';

async function fetchConnectorCredentials(): Promise<{ secretKey: string; webhookSecret?: string } | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    return null;
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(
        `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
        {
          headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (resp.ok) {
        const data = await resp.json() as { items?: Array<{ settings?: { secret?: string; secret_key?: string; webhook_secret?: string } }> };
        const settings = data.items?.[0]?.settings;
        const secretKey = settings?.secret ?? settings?.secret_key;
        if (secretKey) {
          return { secretKey, webhookSecret: settings?.webhook_secret };
        }
        logger.warn({ attempt }, 'Stripe connector responded but returned no secret key');
        return null;
      }

      logger.warn({ attempt, status: resp.status }, 'Stripe connector API request failed');
    } catch (err) {
      logger.warn({ attempt, err }, 'Stripe connector API request threw an error');
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  return null;
}

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  // 1. Replit connectors API — the managed Stripe integration connection. Preferred
  // because it is kept up to date automatically (no stale/expired keys to manage).
  // Retried a few times since a transient failure here must NOT silently fall through
  // to a possibly-stale STRIPE_SECRET_KEY env var (see .agents/memory/stripe-secret-key-precedence.md).
  const connectorCredentials = await fetchConnectorCredentials();
  if (connectorCredentials) {
    return connectorCredentials;
  }

  // 2. Plain env var fallback — only used if the managed connection isn't available
  // after retries. Loudly logged because a stale key here is a known recurring issue.
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) {
    logger.warn(
      'Falling back to STRIPE_SECRET_KEY env var after Stripe connector API was unavailable. ' +
      'This key may be stale/expired — verify the Stripe integration connection if requests start failing with api_key_expired.'
    );
    return { secretKey: envKey, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
  }

  throw new Error(
    'No Stripe credentials found. Connect Stripe via the Integrations tab, ' +
    'or add STRIPE_SECRET_KEY to your secrets.'
  );
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? '',
  });
}
