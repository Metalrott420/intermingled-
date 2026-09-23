import Stripe from 'stripe';
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
  const connectorCredentials = await fetchConnectorCredentials();
  if (connectorCredentials) {
    return connectorCredentials;
  }

  const envKey = process.env.STRIPE_SECRET_KEY;
  if (envKey) {
    return { secretKey: envKey, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
  }

  // Graceful fallback for non-stripe routes so server startup doesn't fail if key is missing at boot
  return { secretKey: "sk_test_dummy", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}
