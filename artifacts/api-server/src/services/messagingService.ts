import { randomBytes } from "crypto";
import { db, messagesTable } from "@workspace/db";
import { getIo } from "../socket";
import { eq } from "drizzle-orm";

export async function saveGameMessage(
  roomId: string,
  participantId: string,
  content: string,
  round: number | null,
  senderUserId: string | null,
  suitorSlot: number | null,
) {
  const id = randomBytes(8).toString("hex");
  const now = new Date();

  await db.insert(messagesTable).values({
    id,
    roomId,
    senderId: participantId,
    senderName: "Participant",
    senderRole: "suitor",
    suitorSlot,
    round,
    content,
    createdAt: now,
  });

  const message = {
    id,
    roomId,
    senderId: participantId,
    suitorSlot,
    round,
    content,
    createdAt: now.toISOString(),
  };

  getIo().to(roomId).emit("message_received", message);
  return message;
}

export async function getRoomMessagesForUser(roomId: string, userId: string) {
  return await db.select().from(messagesTable).where(eq(messagesTable.roomId, roomId));
}

export async function emitRoomUpdated(roomId: string, roomData: any) {
  getIo().to(roomId).emit("room_updated", roomData);
}

export async function emitSessionEnded(roomId: string, payload: any) {
  getIo().to(roomId).emit("session_ended", payload);
}

export async function emitSessionStarted(roomId: string, payload: any) {
  getIo().to(roomId).emit("session_started", payload);
}

export async function emitRoundStarted(roomId: string, round: number, endsAt: Date | null | undefined) {
  getIo().to(roomId).emit("round_started", { round, endsAt });
}

export async function emitTimerSync(roomId: string, endsAt: Date | null | undefined) {
  getIo().to(roomId).emit("timer_sync", { endsAt });
}

export async function emitSuitorEliminated(roomId: string, suitorId: string, roomSnapshotVersion: number) {
  getIo().to(roomId).emit("suitor_eliminated", { suitorId, roomSnapshotVersion });
}

export async function emitRoundAdvanced(roomId: string, round: number, roomSnapshotVersion: number) {
  getIo().to(roomId).emit("round_advanced", { round, roomSnapshotVersion });
}
