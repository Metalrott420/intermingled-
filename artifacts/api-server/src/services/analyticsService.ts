import { logger } from "../lib/logger";

export async function trackGameplayEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> = {},
): Promise<void> {
  logger.info({ event: eventName, ...payload, ...context }, "gameplay_event");
}
