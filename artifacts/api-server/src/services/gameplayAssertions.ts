import { logger } from "../lib/logger";

type RoomLike = {
  id: string;
  status: "waiting" | "active" | "ended";
  currentRound: number;
  winnerId: string | null;
  roomSnapshotVersion: number;
};

const STRICT_ASSERTIONS =
  process.env.GAMEPLAY_STRICT_ASSERTIONS === "true" ||
  (process.env.GAMEPLAY_STRICT_ASSERTIONS !== "false" && process.env.NODE_ENV !== "production");

function failInvariant(message: string, context: Record<string, unknown>) {
  if (STRICT_ASSERTIONS) {
    throw new Error(`${message} :: ${JSON.stringify(context)}`);
  }
  logger.warn({ ...context, invariant: message }, "Gameplay invariant violated");
}

const ALLOWED_TRANSITIONS: Record<RoomLike["status"], RoomLike["status"][]> = {
  waiting: ["waiting", "active", "ended"],
  active: ["active", "ended"],
  ended: ["ended"],
};

export function assertRoomTransition(previous: RoomLike, next: RoomLike, source: string) {
  if (!ALLOWED_TRANSITIONS[previous.status].includes(next.status)) {
    failInvariant("Invalid room status transition", {
      source,
      roomId: previous.id,
      previousStatus: previous.status,
      nextStatus: next.status,
    });
  }

  if (next.roomSnapshotVersion < previous.roomSnapshotVersion) {
    failInvariant("roomSnapshotVersion decreased", {
      source,
      roomId: previous.id,
      previousVersion: previous.roomSnapshotVersion,
      nextVersion: next.roomSnapshotVersion,
    });
  }

  if (next.currentRound < previous.currentRound) {
    failInvariant("Round number regressed", {
      source,
      roomId: previous.id,
      previousRound: previous.currentRound,
      nextRound: next.currentRound,
    });
  }

  if (previous.status === "ended" && previous.winnerId && next.winnerId !== previous.winnerId) {
    failInvariant("Winner changed after finalization", {
      source,
      roomId: previous.id,
      previousWinnerId: previous.winnerId,
      nextWinnerId: next.winnerId,
    });
  }
}

export function assertWinnerImmutable(room: RoomLike, incomingWinnerId: string, source: string) {
  if (room.status === "ended" && room.winnerId && room.winnerId !== incomingWinnerId) {
    failInvariant("Winner change attempted on finalized room", {
      source,
      roomId: room.id,
      existingWinnerId: room.winnerId,
      incomingWinnerId,
    });
  }
}

export function logDuplicateArchive(roomId: string) {
  logger.info({ roomId, invariant: "archive_idempotent_skip" }, "Archive already exists; skipping duplicate archival");
}

export function logDuplicateMatch(roomId: string, chooserUserId: string, suitorUserId: string) {
  logger.info(
    { roomId, chooserUserId, suitorUserId, invariant: "match_idempotent_skip" },
    "Existing match found; skipping duplicate match creation",
  );
}
