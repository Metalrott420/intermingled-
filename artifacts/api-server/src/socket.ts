import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db, messagesTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { logger } from "./lib/logger";

let io: SocketIOServer;

// In-memory set of userIds who have actively joined the pool via socket.
// Only users present here are eligible as suitor candidates.
const activeSuitorPool = new Set<string>();

export function isUserInPool(userId: string): boolean {
  return activeSuitorPool.has(userId);
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/ws/socket.io",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("join_room", ({ roomId }: { roomId: string; participantId: string }) => {
      socket.join(roomId);
      logger.info({ socketId: socket.id, roomId }, "Joined room");
    });

    // Suitor enters their personal socket room and is marked live in the pool
    socket.on("enter_pool", ({ userId }: { userId: string }) => {
      socket.join(`user_${userId}`);
      activeSuitorPool.add(userId);
      logger.info({ socketId: socket.id, userId }, "User entered pool");
    });

    // Chooser joins their personal room so matchmaking can emit slot_filled events
    socket.on("chooser_waiting", ({ userId }: { userId: string }) => {
      socket.join(`user_${userId}`);
      logger.info({ socketId: socket.id, userId }, "Chooser waiting for match");
    });

    socket.on("leave_pool", ({ userId }: { userId: string }) => {
      socket.leave(`user_${userId}`);
      activeSuitorPool.delete(userId);
      logger.info({ socketId: socket.id, userId }, "User left pool");
    });

    socket.on(
      "send_message",
      async ({
        roomId,
        participantId,
        senderName,
        senderRole,
        content,
        suitorSlot,
      }: {
        roomId: string;
        participantId: string;
        senderName: string;
        senderRole: "chooser" | "suitor";
        content: string;
        suitorSlot: number | null;
      }) => {
        try {
          const id = randomBytes(8).toString("hex");
          const now = new Date();
          await db.insert(messagesTable).values({
            id,
            roomId,
            senderId: participantId,
            senderName,
            senderRole,
            suitorSlot: suitorSlot ?? null,
            content,
            createdAt: now,
          });

          const msg = {
            id,
            roomId,
            senderId: participantId,
            senderName,
            senderRole,
            suitorSlot: suitorSlot ?? null,
            content,
            createdAt: now.toISOString(),
          };

          io.to(roomId).emit("message_received", msg);
        } catch (err) {
          logger.error({ err }, "Failed to save message");
        }
      },
    );

    socket.on("disconnect", () => {
      // Clean up pool membership on disconnect; socket rooms are auto-cleaned by socket.io
      for (const userId of activeSuitorPool) {
        // We don't have a userId→socketId map, but socket.io rooms let us check membership
        const room = io.sockets.adapter.rooms.get(`user_${userId}`);
        if (!room || room.size === 0) {
          activeSuitorPool.delete(userId);
          logger.info({ userId }, "Removed from active pool on disconnect");
        }
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
