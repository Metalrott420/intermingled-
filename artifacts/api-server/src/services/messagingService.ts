import { db, messagesTable, participantsTable, roomsTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { getIo } from "../socket";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";
import {
  SocketEvents,
  MessageReceivedPayload,
  SessionEndedPayload,
  RoomUpdatedPayload,
} from "../socket/events";
import { recordQuestionAnswered, recordQuestionAsked } from "./questionTelemetryService";

const lastEmittedRoomVersion = new Map<string, number>();
const STRICT_EMIT_ASSERTIONS =
  process.env.GAMEPLAY_STRICT_ASSERTIONS === "true" ||
  (process.env.GAMEPLAY_STRICT_ASSERTIONS !== "false" && process.env.NODE_ENV !== "production");

function assertEmitVersionMonotonic(roomId: string, incomingVersion: number, source: string) {
  const previous = lastEmittedRoomVersion.get(roomId);
  if (typeof previous === "number" && incomingVersion < previous) {
    const message = `Snapshot version regressed in ${source} for room ${roomId}: ${incomingVersion} < ${previous}`;
    if (STRICT_EMIT_ASSERTIONS) {
      throw new Error(message);
    }
    logger.warn({ roomId, source, incomingVersion, previous }, message);
    return;
  }
  lastEmittedRoomVersion.set(roomId, incomingVersion);
}

const anthropicClient = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  ? new Anthropic({
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
    })
  : null;

/**
 * Uses the Anthropic AI client when available, otherwise falls back to canned replies.
 */
async function generateBotResponse(
  roomId: string,
  botParticipant: { id: string; name: string; suitorSlot: number | null; isBot: boolean },
  chooserQuestion: string,
  round: number | null,
) {
  await new Promise<void>((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

  const fallbacks = [
    "That's an interesting question — I'd say I live for the unexpected.",
    "Hmm, honestly? I think you'd have to find out in person.",
    "I like to think I'm an open book, but with a few locked chapters.",
    "That really depends on who's asking... and I like how you ask.",
    "I could answer that, but then I'd have to take you on a second date.",
  ];
  let responseText = fallbacks[Math.floor(Math.random() * fallbacks.length)]!;

  if (anthropicClient) {
    try {
      const message = await anthropicClient.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `You are ${botParticipant.name}, a charming, witty contestant on a speed-dating show. Keep answers short (1-2 sentences), playful, a little mysterious, and never too specific about yourself. Answer this question: "${chooserQuestion}"`,
          },
        ],
      });
      const block = message.content[0];
      if (block?.type === "text") responseText = block.text.trim();
    } catch (err) {
      // Keep fallback text when AI generation fails.
    }
  }

  const now = new Date();
  const id = randomBytes(8).toString("hex");

  await db.insert(messagesTable).values({
    id,
    roomId,
    senderId: botParticipant.id,
    senderName: botParticipant.name,
    senderRole: "suitor",
    suitorSlot: botParticipant.suitorSlot,
    round,
    content: responseText,
    createdAt: now,
  });

  getIo().to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, {
    id,
    roomId,
    senderId: botParticipant.id,
    senderName: botParticipant.name,
    senderRole: "suitor",
    suitorSlot: botParticipant.suitorSlot,
    round,
    content: responseText,
    createdAt: now.toISOString(),
  });

  if (round !== null && botParticipant.suitorSlot !== null) {
    await recordQuestionAnswered({
      roomId,
      participantId: botParticipant.id,
      round,
      suitorSlot: botParticipant.suitorSlot,
      answerMessageId: id,
      answeredAtIso: now.toISOString(),
      responseLength: responseText.length,
    });
  }
}

export async function saveGameMessage(
  roomId: string,
  participantId: string,
  content: string,
  round: number | null,
  dbUserId?: string | null,
  chooserSuitorSlot?: number | null,
): Promise<MessageReceivedPayload> {
  const trimmed = content?.trim();
  if (!trimmed) throw new Error("Message content is required");

  const participant = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.id, participantId), eq(participantsTable.roomId, roomId)),
  });
  if (!participant) throw new Error("Invalid room or participant");

  if (participant.userId && participant.userId !== dbUserId) {
    throw new Error("Unauthorized: not the participant owner");
  }

  const resolvedSlot =
    participant.role === "chooser" ? chooserSuitorSlot ?? null : participant.suitorSlot ?? null;
  const now = new Date();
  const id = randomBytes(8).toString("hex");

  await db.insert(messagesTable).values({
    id,
    roomId,
    senderId: participant.id,
    senderName: participant.name,
    senderRole: participant.role,
    suitorSlot: resolvedSlot,
    round,
    content: trimmed,
    createdAt: now,
  });

  const msg: MessageReceivedPayload = {
    id,
    roomId,
    senderId: participant.id,
    senderName: participant.name,
    senderRole: participant.role,
    suitorSlot: resolvedSlot,
    round,
    content: trimmed,
    createdAt: now.toISOString(),
  };

  getIo().to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, msg);

  if (participant.role === "chooser" && resolvedSlot !== null && round !== null) {
    await recordQuestionAsked({
      roomId,
      participantId: participant.id,
      round,
      suitorSlot: resolvedSlot,
      questionMessageId: id,
      askedAtIso: now.toISOString(),
      questionLength: trimmed.length,
    });
  }

  if (participant.role === "suitor" && resolvedSlot !== null && round !== null) {
    await recordQuestionAnswered({
      roomId,
      participantId: participant.id,
      round,
      suitorSlot: resolvedSlot,
      answerMessageId: id,
      answeredAtIso: now.toISOString(),
      responseLength: trimmed.length,
    });
  }

  if (participant.role === "chooser" && resolvedSlot !== null) {
    const botParticipant = await db.query.participantsTable.findFirst({
      where: and(
        eq(participantsTable.roomId, roomId),
        eq(participantsTable.suitorSlot, resolvedSlot),
        eq(participantsTable.isBot, true),
      ),
    });
    if (botParticipant) {
      await generateBotResponse(roomId, botParticipant, trimmed, round);
    }
  }

  return msg;
}

export async function getRoomMessagesForUser(roomId: string, dbUserId: string) {
  const participant = await db.query.participantsTable.findFirst({
    where: and(eq(participantsTable.roomId, roomId), eq(participantsTable.userId, dbUserId)),
  });
  if (!participant) throw new Error("Forbidden");

  const msgs = await db.query.messagesTable.findMany({
    where: eq(messagesTable.roomId, roomId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  return msgs.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    suitorSlot: m.suitorSlot ?? null,
    round: m.round ?? null,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Emits the session started payload when the game moves into active play.
 *
 * @param roomId - session id
 * @param payload - room state payload to send
 */
export async function emitSessionStarted(roomId: string, payload: RoomUpdatedPayload): Promise<void> {
  assertEmitVersionMonotonic(roomId, payload.roomSnapshotVersion, "emitSessionStarted");
  getIo().to(roomId).emit(SocketEvents.SESSION_STARTED, { room: payload });
}

export async function emitCountdownStarted(roomId: string, startsAt: Date, round: number): Promise<void> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  const version = room?.roomSnapshotVersion ?? 0;
  assertEmitVersionMonotonic(roomId, version, "emitCountdownStarted");
  getIo().to(roomId).emit(SocketEvents.COUNTDOWN_STARTED, {
    roomId,
    startsAt: startsAt.toISOString(),
    round,
    roomSnapshotVersion: version,
  });
}

export async function emitRoundStarted(roomId: string, round: number, endsAt: Date | null): Promise<void> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  const version = room?.roomSnapshotVersion ?? 0;
  assertEmitVersionMonotonic(roomId, version, "emitRoundStarted");
  getIo().to(roomId).emit(SocketEvents.ROUND_STARTED, {
    roomId,
    round,
    endsAt: endsAt ? endsAt.toISOString() : null,
    roomSnapshotVersion: version,
  });
}

export async function emitTimerSync(roomId: string, endsAt: Date | null): Promise<void> {
  const room = await db.query.roomsTable.findFirst({ where: eq(roomsTable.id, roomId) });
  const version = room?.roomSnapshotVersion ?? 0;
  assertEmitVersionMonotonic(roomId, version, "emitTimerSync");
  getIo().to(roomId).emit(SocketEvents.TIMER_SYNC, {
    roomId,
    endsAt: endsAt ? endsAt.toISOString() : null,
    roomSnapshotVersion: version,
  });
}

/**
 * Emits a game session end event with reason metadata.
 *
 * @param roomId - session id
 * @param payload - final session end payload
 */
export async function emitSessionEnded(roomId: string, payload: SessionEndedPayload): Promise<void> {
  assertEmitVersionMonotonic(roomId, payload.roomSnapshotVersion, "emitSessionEnded");
  getIo().to(roomId).emit(SocketEvents.SESSION_ENDED, payload);
}

/**
 * Emits an updated room payload to all clients in the session.
 *
 * @param roomId - session id
 * @param payload - canonical room payload
 */
export async function emitRoomUpdated(roomId: string, payload: RoomUpdatedPayload): Promise<void> {
  assertEmitVersionMonotonic(roomId, payload.roomSnapshotVersion, "emitRoomUpdated");
  getIo().to(roomId).emit(SocketEvents.ROOM_UPDATED, payload);
}

/**
 * Emits a suitor elimination event for the current session.
 *
 * @param roomId - session id
 * @param participantId - eliminated participant id
 */
export async function emitSuitorEliminated(roomId: string, participantId: string, roomSnapshotVersion: number): Promise<void> {
  assertEmitVersionMonotonic(roomId, roomSnapshotVersion, "emitSuitorEliminated");
  getIo().to(roomId).emit(SocketEvents.SUITOR_ELIMINATED, { participantId, roomSnapshotVersion });
}

/**
 * Emits a round advanced event when the session moves to the next round.
 *
 * @param roomId - session id
 * @param round - new round number
 */
export async function emitRoundAdvanced(roomId: string, round: number, roomSnapshotVersion: number): Promise<void> {
  assertEmitVersionMonotonic(roomId, roomSnapshotVersion, "emitRoundAdvanced");
  getIo().to(roomId).emit(SocketEvents.ROUND_ADVANCED, { round, roomSnapshotVersion });
}
