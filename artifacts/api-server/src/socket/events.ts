export enum SocketEvents {
  POOL_COUNT = "pool_count",
  MATCH_FOUND = "match_found",
  SLOT_FILLED = "slot_filled",
  ROOM_UPDATED = "room_updated",
  SESSION_STARTED = "session_started",
  COUNTDOWN_STARTED = "countdown_started",
  ROUND_STARTED = "round_started",
  TIMER_SYNC = "timer_sync",
  MESSAGE_RECEIVED = "message_received",
  ROUND_ADVANCED = "round_advanced",
  SUITOR_ELIMINATED = "suitor_eliminated",
  SESSION_ENDED = "session_ended",
  ERROR = "error",
}

export interface PoolCountPayload {
  count: number;
}

export interface MatchFoundPayload {
  roomId: string;
  participantId: string;
}

export interface SlotFilledPayload {
  slot: number;
  suitorName: string;
  participantId: string;
  roomId: string;
}

export interface RoomUpdatedPayload {
  id: string;
  code: string;
  status: string;
  roomSnapshotVersion: number;
  chooserName: string | null;
  suitorCount: number;
  maxSuitors: number;
  numberOfRounds: number;
  roundDurationSeconds: number;
  answerTimeSeconds: number;
  roundEndsAt: string | null;
  currentRound: number;
  eliminatedParticipants: string[];
  winnerId: string | null;
  winnerName: string | null;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    suitorSlot: number | null;
    isBot: boolean;
    isPremium: boolean;
  }>;
  createdAt: string;
}

export interface SessionStartedPayload {
  room: RoomUpdatedPayload;
}

export interface CountdownStartedPayload {
  roomId: string;
  startsAt: string; // ISO
  round: number;
  roomSnapshotVersion: number;
}

export interface RoundStartedPayload {
  roomId: string;
  round: number;
  endsAt: string | null;
  roomSnapshotVersion: number;
}

export interface TimerSyncPayload {
  roomId: string;
  endsAt: string | null;
  roomSnapshotVersion: number;
}

export interface MessageReceivedPayload {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  suitorSlot: number | null;
  round: number | null;
  content: string;
  createdAt: string;
}

export interface RoundAdvancedPayload {
  round: number;
  roomSnapshotVersion: number;
}

export interface SuitorEliminatedPayload {
  participantId: string;
  roomSnapshotVersion: number;
}

export interface SessionEndedPayload {
  winnerName: string | null;
  winnerId: string | null;
  reason?: string;
  roomSnapshotVersion: number;
}

export interface ErrorPayload {
  message: string;
}
