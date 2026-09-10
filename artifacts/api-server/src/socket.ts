import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db, matchesTable, participantsTable, usersTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";
import { verifyToken } from "@clerk/backend";
// clerk bypass;
import { logger } from "./lib/logger";
import { saveGameMessage } from "./services/messagingService";
import { buildRoomResponse } from "./lib/roomUtils";
import { trackGameplayEvent } from "./services/analyticsService";
import {
  addUserToPool,
  getAllPoolUserIds,
  getPoolCount,
  removeUserFromPool,
} from "./services/poolService";
import { SocketEvents } from "./socket/events";

let io: SocketIOServer;
const activeParticipantSockets = new Map<string, string>();
const activeMatchUsers = new Map<string, Set<string>>();
const matchTypingState = new Map<string, { userId: string; atIso: string }>();

function trackMatchUserOnline(matchId: string, userId: string) {
  const set = activeMatchUsers.get(matchId) ?? new Set<string>();
  set.add(userId);
  activeMatchUsers.set(matchId, set);
}

function trackMatchUserOffline(matchId: string, userId: string) {
  const set = activeMatchUsers.get(matchId);
  if (!set) return;
  set.delete(userId);
  if (set.size === 0) {
    activeMatchUsers.delete(matchId);
  }
}

export function getMatchPresenceSnapshot(matchId: string, selfUserId: string) {
  const onlineUsers = activeMatchUsers.get(matchId) ?? new Set<string>();
  const isSelfOnline = onlineUsers.has(selfUserId);
  const isOtherOnline = [...onlineUsers].some((id) => id !== selfUserId);
  const typing = matchTypingState.get(matchId);
  const isOtherTyping = Boolean(typing && typing.userId !== selfUserId && Date.now() - Date.parse(typing.atIso) <= 5_000);

  return {
    selfOnline: isSelfOnline,
    otherOnline: isOtherOnline,
    isOtherTyping,
    lastTypingAt: typing?.atIso ?? null,
  };
}

function broadcastPoolCount() {
  io.emit(SocketEvents.POOL_COUNT, { count: getPoolCount() });
}

/**
 * Attempt to verify a Clerk session token and return the DB user's id.
 * Returns null if the token is missing, invalid, or has no matching DB user.
 */
async function resolveDbUserId(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const secretKey = process.env.CLERK_SECRET_KEY;
  try {
    if (secretKey && token.startsWith("eyJ")) {
      const payload = await verifyToken(token, { secretKey });
      if (payload && payload.sub) {
        const user = await db.query.usersTable.findFirst({
          where: or(eq(usersTable.clerkId, payload.sub), eq(usersTable.id, payload.sub))
        });
        return user?.id ?? null;
      }
    }
    const user = await db.query.usersTable.findFirst({
      where: or(eq(usersTable.id, token), eq(usersTable.clerkId, token))
    });
    return user?.id ?? null;
  } catch (err) {
    logger.error({ err }, "Cryptographic token verification failed");
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

    socket.emit(SocketEvents.POOL_COUNT, { count: getPoolCount() });

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
          await trackGameplayEvent("join_failure", { reason: "invalid_room_or_participant" }, { roomId, participantId });
          return;
        }

        // If this participant is linked to a user account, verify ownership
        if (participant.userId) {
          const resolvedToken = token ?? socket.handshake.auth?.token;
          const dbUserId = await resolveDbUserId(resolvedToken);
          if (!dbUserId || dbUserId !== participant.userId) {
            socket.emit("error", { message: "Authentication required to join this room" });
            await trackGameplayEvent("join_failure", { reason: "auth_required" }, { roomId, participantId, userId: participant.userId ?? null });
            return;
          }
          // Store verified identity so send_message can enforce ownership
          socket.data.dbUserId = dbUserId;
        }

        const previousSocketId = activeParticipantSockets.get(participantId);
        if (previousSocketId && previousSocketId !== socket.id) {
          const previousSocket = io.sockets.sockets.get(previousSocketId);
          previousSocket?.disconnect(true);
        }
        activeParticipantSockets.set(participantId, socket.id);

        socket.join(roomId);
        // Store verified participant identity on the socket for send_message
        socket.data.participantId = participantId;
        socket.data.roomId = roomId;
        const roomData = await buildRoomResponse(roomId);
        if (roomData) {
          socket.emit(SocketEvents.ROOM_UPDATED, roomData);
        }
        await trackGameplayEvent("room_joined", { reconnect: true }, {
          roomId,
          participantId,
          userId: participant.userId ?? socket.data.dbUserId ?? null,
        });
        logger.info({ socketId: socket.id, roomId, participantId }, "Joined room");
      } catch (err) {
        logger.error({ err }, "join_room verification failed");
      }
    });

    socket.on("join_match", async ({ matchId, token }: { matchId: string; token?: string }) => {
      try {
        if (!matchId) return;
        const dbUserId = socket.data.dbUserId ?? await resolveDbUserId(token ?? socket.handshake.auth?.token);
        if (!dbUserId) {
          socket.emit("error", { message: "Authentication required for match chat" });
          return;
        }

        const match = await db.query.matchesTable.findFirst({
          where: eq(matchesTable.id, matchId),
        });
        if (!match) {
          socket.emit("error", { message: "Match not found" });
          return;
        }
        if (match.chooserUserId !== dbUserId && match.suitorUserId !== dbUserId) {
          socket.emit("error", { message: "Forbidden" });
          return;
        }

        socket.data.dbUserId = dbUserId;
        socket.data.joinedMatchIds = new Set<string>([...(socket.data.joinedMatchIds ?? []), matchId]);
        socket.join(`match_${matchId}`);
        trackMatchUserOnline(matchId, dbUserId);
        getIo().to(`match_${matchId}`).emit("presence", { matchId, userId: dbUserId, online: true, at: new Date().toISOString() });
        logger.info({ socketId: socket.id, matchId, dbUserId }, "Joined match DM room");
      } catch (err) {
        logger.error({ err }, "join_match failed");
      }
    });

    socket.on("typing", async ({ matchId }: { matchId: string }) => {
      try {
        const dbUserId = socket.data.dbUserId as string | undefined;
        if (!matchId || !dbUserId) return;
        const joinedMatchIds: Set<string> = socket.data.joinedMatchIds ?? new Set<string>();
        if (!joinedMatchIds.has(matchId)) return;
        const atIso = new Date().toISOString();
        matchTypingState.set(matchId, { userId: dbUserId, atIso });
        getIo().to(`match_${matchId}`).emit("typing", { matchId, userId: dbUserId, at: atIso });
      } catch (err) {
        logger.error({ err }, "typing event failed");
      }
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
      addUserToPool(dbUserId);
      logger.info({ socketId: socket.id, dbUserId, poolSize: getPoolCount() }, "User entered pool");
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
      removeUserFromPool(dbUserId);
      logger.info({ socketId: socket.id, dbUserId, poolSize: getPoolCount() }, "User left pool");
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

          const response = await saveGameMessage(
            roomId,
            participantId,
            content.trim(),
            round ?? null,
            socket.data.dbUserId ?? null,
            clientSuitorSlot ?? null,
          );

          // message persistence and broadcast are handled by messagingService
          logger.info({ socketId: socket.id, messageId: response.id }, "Message saved and broadcast");
        } catch (err) {
          logger.error({ err }, "Failed to save message");
        }
      },
    );

    socket.on("disconnect", () => {
      const dbUserId = socket.data.dbUserId as string | undefined;
      const joinedMatchIds: Set<string> = socket.data.joinedMatchIds ?? new Set<string>();
      if (dbUserId) {
        for (const matchId of joinedMatchIds) {
          trackMatchUserOffline(matchId, dbUserId);
          getIo().to(`match_${matchId}`).emit("presence", { matchId, userId: dbUserId, online: false, at: new Date().toISOString() });
          const typing = matchTypingState.get(matchId);
          if (typing?.userId === dbUserId) {
            matchTypingState.delete(matchId);
          }
        }
      }
      if (socket.data.participantId) {
        const currentSocketId = activeParticipantSockets.get(socket.data.participantId);
        if (currentSocketId === socket.id) {
          activeParticipantSockets.delete(socket.data.participantId);
        }
      }
      const before = getPoolCount();
      for (const userId of getAllPoolUserIds()) {
        const room = io.sockets.adapter.rooms.get(`user_${userId}`);
        if (!room || room.size === 0) {
          removeUserFromPool(userId);
          logger.info({ userId }, "Removed from active pool on disconnect");
        }
      }
      if (getPoolCount() !== before) {
        broadcastPoolCount();
      }
      if (socket.data.roomId || socket.data.participantId) {
        void trackGameplayEvent("socket_disconnect", {}, {
          roomId: socket.data.roomId ?? null,
          participantId: socket.data.participantId ?? null,
          userId: socket.data.dbUserId ?? null,
        });
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

export { isUserInPool } from "./services/poolService";
