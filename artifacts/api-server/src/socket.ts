import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db, messagesTable, participantsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { verifyToken } from "@clerk/express";
import { logger } from "./lib/logger";
import Anthropic from "@anthropic-ai/sdk";

let io: SocketIOServer;

const anthropicClient = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
  ? new Anthropic({
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "dummy",
    })
  : null;

async function generateBotResponse(
  roomId: string,
  botParticipant: { id: string; name: string; suitorSlot: number | null; isBot: boolean },
  chooserQuestion: string,
  round: number | undefined,
) {
  // Realistic typing delay: 1–3 seconds
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
      logger.error({ err }, "Anthropic bot response failed, using fallback");
    }
  }

  const msgId = randomBytes(8).toString("hex");
  const now = new Date();

  await db.insert(messagesTable).values({
    id: msgId,
    roomId,
    senderId: botParticipant.id,
    senderName: botParticipant.name,
    senderRole: "suitor",
    suitorSlot: botParticipant.suitorSlot,
    round: round ?? null,
    content: responseText,
    createdAt: now,
  });

  io.to(roomId).emit("message_received", {
    id: msgId,
    roomId,
    senderId: botParticipant.id,
    senderName: botParticipant.name,
    senderRole: "suitor",
    suitorSlot: botParticipant.suitorSlot,
    round: round ?? null,
    content: responseText,
    createdAt: now.toISOString(),
  });
}

const activeSuitorPool = new Set<string>();

export function isUserInPool(userId: string): boolean {
  return activeSuitorPool.has(userId);
}

export function getPoolCount(): number {
  return activeSuitorPool.size;
}

function broadcastPoolCount() {
  io.emit("pool_count", { count: activeSuitorPool.size });
}

/**
 * Attempt to verify a Clerk session token and return the DB user's id.
 * Returns null if the token is missing, invalid, or has no matching DB user.
 */
async function resolveDbUserId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const clerkUserId = payload.sub;
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUserId));
    return row?.id ?? null;
  } catch {
    return null;
  }
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/ws/socket.io",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.emit("pool_count", { count: activeSuitorPool.size });

    // join_room — verify the participant record exists and, when the participant
    // is linked to a registered user (participants.user_id is set), require a
    // valid Clerk token proving the socket owner IS that user.  Anonymous
    // participants (userId = null, legacy manual-room flow) may join without a
    // token.
    socket.on("join_room", async ({
      roomId,
      participantId,
      token,
    }: {
      roomId: string;
      participantId: string;
      token?: string;
    }) => {
      try {
        if (!roomId || !participantId) return;
        const participant = await db.query.participantsTable.findFirst({
          where: and(
            eq(participantsTable.id, participantId),
            eq(participantsTable.roomId, roomId),
          ),
        });
        if (!participant) {
          socket.emit("error", { message: "Invalid room or participant" });
          return;
        }

        // If this participant is linked to a user account, verify ownership
        if (participant.userId) {
          const resolvedToken = token ?? socket.handshake.auth?.token;
          const dbUserId = await resolveDbUserId(resolvedToken);
          if (!dbUserId || dbUserId !== participant.userId) {
            socket.emit("error", { message: "Authentication required to join this room" });
            return;
          }
          // Store verified identity so send_message can enforce ownership
          socket.data.dbUserId = dbUserId;
        }

        socket.join(roomId);
        // Store verified participant identity on the socket for send_message
        socket.data.participantId = participantId;
        socket.data.roomId = roomId;
        logger.info({ socketId: socket.id, roomId, participantId }, "Joined room");
      } catch (err) {
        logger.error({ err }, "join_room verification failed");
      }
    });

    socket.on("join_match", ({ matchId }: { matchId: string }) => {
      socket.join(`match_${matchId}`);
      logger.info({ socketId: socket.id, matchId }, "Joined match DM room");
    });

    // enter_pool — requires a valid Clerk session token so the server can bind
    // the socket to the authenticated user; client-supplied userId is rejected.
    socket.on("enter_pool", async ({ token }: { token?: string; userId?: string }) => {
      const dbUserId = await resolveDbUserId(token ?? socket.handshake.auth?.token);
      if (!dbUserId) {
        socket.emit("error", { message: "Authentication required to enter pool" });
        return;
      }
      socket.join(`user_${dbUserId}`);
      socket.data.dbUserId = dbUserId;
      activeSuitorPool.add(dbUserId);
      logger.info({ socketId: socket.id, dbUserId, poolSize: activeSuitorPool.size }, "User entered pool");
      broadcastPoolCount();
    });

    // chooser_waiting — same: bind via verified token, not client-supplied userId.
    socket.on("chooser_waiting", async ({ token }: { token?: string; userId?: string }) => {
      const dbUserId = await resolveDbUserId(token ?? socket.handshake.auth?.token);
      if (!dbUserId) {
        socket.emit("error", { message: "Authentication required" });
        return;
      }
      socket.join(`user_${dbUserId}`);
      socket.data.dbUserId = dbUserId;
      logger.info({ socketId: socket.id, dbUserId }, "Chooser waiting for match");
    });

    socket.on("leave_pool", async ({ token }: { token?: string; userId?: string }) => {
      // Prefer the identity we stored when they entered the pool
      const dbUserId: string | undefined =
        socket.data.dbUserId ?? (await resolveDbUserId(token ?? socket.handshake.auth?.token) ?? undefined);
      if (!dbUserId) return;
      socket.leave(`user_${dbUserId}`);
      activeSuitorPool.delete(dbUserId);
      logger.info({ socketId: socket.id, dbUserId, poolSize: activeSuitorPool.size }, "User left pool");
      broadcastPoolCount();
    });

    // send_message — enforce that the socket previously joined as the declared
    // participant (socket.data.participantId must match), then look up
    // authoritative name/role/slot from DB so clients cannot forge sender identity.
    socket.on(
      "send_message",
      async ({
        roomId,
        participantId,
        content,
        suitorSlot: clientSuitorSlot,
        round,
      }: {
        roomId: string;
        participantId: string;
        content: string;
        senderName?: string;
        senderRole?: string;
        suitorSlot?: number | null;
        round?: number;
      }) => {
        try {
          if (!roomId || !participantId || !content?.trim()) return;

          // Reject if the socket did not join the room as this participant
          if (
            socket.data.participantId !== participantId ||
            socket.data.roomId !== roomId
          ) {
            socket.emit("error", { message: "Unauthorized: identity mismatch" });
            return;
          }

          // Verify participantId belongs to the room (double-check against DB)
          const participant = await db.query.participantsTable.findFirst({
            where: and(
              eq(participantsTable.id, participantId),
              eq(participantsTable.roomId, roomId),
            ),
          });
          if (!participant) {
            socket.emit("error", { message: "Invalid participant or room" });
            return;
          }

          // For registered-user participants, enforce that the authenticated
          // socket user is the owner of this participant record.
          if (participant.userId && socket.data.dbUserId !== participant.userId) {
            socket.emit("error", { message: "Unauthorized: not the participant owner" });
            return;
          }

          const id = randomBytes(8).toString("hex");
          const now = new Date();

          // For choosers, use the client-supplied suitorSlot so their messages
          // are routed to the correct suitor tab; for suitors use their DB slot.
          const resolvedSlot =
            participant.role === "chooser"
              ? (clientSuitorSlot ?? null)
              : (participant.suitorSlot ?? null);

          await db.insert(messagesTable).values({
            id,
            roomId,
            senderId: participant.id,
            senderName: participant.name,
            senderRole: participant.role,
            suitorSlot: resolvedSlot,
            round: round ?? null,
            content: content.trim(),
            createdAt: now,
          });

          const msg = {
            id,
            roomId,
            senderId: participant.id,
            senderName: participant.name,
            senderRole: participant.role,
            suitorSlot: resolvedSlot,
            round: round ?? null,
            content: content.trim(),
            createdAt: now.toISOString(),
          };

          io.to(roomId).emit("message_received", msg);

          // If a chooser addressed a bot suitor, trigger an AI response
          if (participant.role === "chooser" && resolvedSlot !== null) {
            const botParticipant = await db.query.participantsTable.findFirst({
              where: and(
                eq(participantsTable.roomId, roomId),
                eq(participantsTable.suitorSlot, resolvedSlot),
                eq(participantsTable.isBot, true),
              ),
            });
            if (botParticipant) {
              generateBotResponse(roomId, botParticipant, content.trim(), round).catch(
                (err) => logger.error({ err }, "Bot response pipeline failed"),
              );
            }
          }
        } catch (err) {
          logger.error({ err }, "Failed to save message");
        }
      },
    );

    socket.on("disconnect", () => {
      const before = activeSuitorPool.size;
      for (const userId of activeSuitorPool) {
        const room = io.sockets.adapter.rooms.get(`user_${userId}`);
        if (!room || room.size === 0) {
          activeSuitorPool.delete(userId);
          logger.info({ userId }, "Removed from active pool on disconnect");
        }
      }
      if (activeSuitorPool.size !== before) {
        broadcastPoolCount();
      }
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export function getIo(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
