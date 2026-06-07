import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { db, messagesTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { logger } from "./lib/logger";

let io: SocketIOServer;

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
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  return io;
}

export function getIo(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
