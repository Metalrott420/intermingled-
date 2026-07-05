import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...payload, sound: payload.sound ?? "default" }),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.warn({ status: res.status, text }, "Push notification request failed");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to send push notification");
  }
}

export async function sendPushNotifications(payloads: PushPayload[]): Promise<void> {
  if (payloads.length === 0) return;
  const chunks: PushPayload[][] = [];
  for (let i = 0; i < payloads.length; i += 100) {
    chunks.push(payloads.slice(i, i + 100));
  }
  await Promise.allSettled(
    chunks.map((chunk) =>
      fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      }).catch((err) => logger.warn({ err }, "Push chunk failed")),
    ),
  );
}
