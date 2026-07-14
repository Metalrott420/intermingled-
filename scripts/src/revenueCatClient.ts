import { createClient } from "@replit/revenuecat-sdk/client";

async function getRevenueCatCredentials(): Promise<{ apiKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. Ensure the RevenueCat integration is connected.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch RevenueCat credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{ settings?: { api_key?: string; secret_key?: string } }>;
  };
  const settings = data.items?.[0]?.settings;
  const apiKey = settings?.api_key ?? settings?.secret_key;

  if (!apiKey) {
    throw new Error(
      "RevenueCat integration not connected or missing API key.",
    );
  }

  return { apiKey };
}

export async function getUncachableRevenueCatClient() {
  const { apiKey } = await getRevenueCatCredentials();
  return createClient({
    auth: apiKey,
    baseUrl: "https://api.revenuecat.com",
  });
}
