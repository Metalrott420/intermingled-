import { eq } from "drizzle-orm";
import { db, roomsTable, participantsTable } from "@workspace/db";

export async function buildRoomResponse(roomId: string) {
  const room = await db.query.roomsTable.findFirst({
    where: eq(roomsTable.id, roomId),
  });
  if (!room) return null;

  const participants = await db.query.participantsTable.findMany({
    where: eq(participantsTable.roomId, roomId),
  });

  const suitorCount = participants.filter((p) => p.role === "suitor").length;

  return {
    id: room.id,
    code: room.code,
    status: room.status,
    chooserName: room.chooserName ?? null,
    suitorCount,
    maxSuitors: room.maxSuitors,
    currentRound: room.currentRound,
    eliminatedParticipants: (room.eliminatedParticipants ?? []) as string[],
    winnerId: room.winnerId ?? null,
    winnerName: room.winnerName ?? null,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      suitorSlot: p.suitorSlot ?? null,
      isBot: p.isBot,
      isPremium: p.isPremium,
    })),
    createdAt: room.createdAt.toISOString(),
  };
}
