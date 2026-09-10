import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, messagesTable, participantsTable } from "@workspace/db";
import { getIo } from "../socket";
import { logger } from "../lib/logger";

function makeId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Persists a chat message for a room and broadcasts it to all connected
 * clients in that room. Sender identity (name/role/slot) is resolved from
 * the authoritative participant record rather than trusting client input.
 */
export async function saveGameMessage(
  roomId: string,
  participantId: string,
  content: string,
  round: number | null,
  senderDbUserId: string | null,
  suitorSlot: number | null,
) {
  const participant = await db.query.participantsTable.findFirst({
    where: and(
      eq(participantsTable.id, participantId),
      eq(participantsTable.roomId, roomId),
    ),
  });

  if (!participant) {
    throw new Error("Cannot save message: participant not found for room");
  }

  const id = makeId();
  const resolvedSuitorSlot = participant.suitorSlot ?? suitorSlot ?? null;

  await db.insert(messagesTable).values({
    id,
    roomId,
    senderId: senderDbUserId ?? participant.userId ?? participant.id,
    senderName: participant.name,
    senderRole: participant.role,
    suitorSlot: resolvedSuitorSlot,
    round,
    content,
  });

  const message = await db.query.messagesTable.findFirst({
    where: eq(messagesTable.id, id),
  });

  if (!message) {
    throw new Error("Failed to persist message");
  }

  try {
    getIo().to(roomId).emit("message_received", {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      suitorSlot: message.suitorSlot ?? null,
      round: message.round ?? null,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to broadcast message_received");
  }

  return message;
}
