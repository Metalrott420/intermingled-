export const SocketEvents = {
  POOL_COUNT: "pool_count",
  ROOM_UPDATED: "room_updated",
  MESSAGE_RECEIVED: "message_received",
} as const;

export type RoomUpdatedPayload = any;
