import { db, gameplayEventsTable } from "@workspace/db";
import { makeId } from "./utils";

export async function trackGameplayEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  context?: { roomId?: string | null; userId?: string | null; participantId?: string | null },
): Promise<void> {
  try {
    await db.insert(gameplayEventsTable).values({
      id: makeId(),
      eventType,
      roomId: context?.roomId ?? null,
      userId: context?.userId ?? null,
      participantId: context?.participantId ?? null,
      payload,
    });
  } catch {
    // Analytics must never break gameplay.
  }
}
