import { Message, Room } from "@workspace/api-client-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "localhost"}`;
const SOCKET_PATH = "/ws/socket.io";

// ─── Pool socket (suitor waiting) ────────────────────────────────────────────

export function usePoolSocket(
  userId: string | undefined,
  onMatchFound: (roomId: string, participantId: string) => void,
  token?: string,
) {
  const socketRef = useRef<Socket | null>(null);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;

  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("enter_pool", { userId, ...(token ? { token } : {}) });
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("pool_count", ({ count }: { count: number }) => setPoolCount(count));
    socket.on(
      "match_found",
      ({ roomId, participantId }: { roomId: string; participantId: string }) => {
        onMatchFoundRef.current(roomId, participantId);
      },
    );

    return () => {
      if (socket.connected && userId) socket.emit("leave_pool", { userId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token]);

  const leavePool = useCallback(() => {
    if (socketRef.current?.connected && userId) {
      socketRef.current.emit("leave_pool", { userId });
    }
  }, [userId]);

  return { isConnected, poolCount, leavePool };
}

// ─── Chooser socket (waiting for slot fills) ─────────────────────────────────

export function useChooserSocket(
  userId: string | undefined,
  onSlotFilled: (slot: number, suitorName: string) => void,
  token?: string,
) {
  const socketRef = useRef<Socket | null>(null);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onSlotFilledRef = useRef(onSlotFilled);
  onSlotFilledRef.current = onSlotFilled;

  useEffect(() => {
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("chooser_waiting", { userId, ...(token ? { token } : {}) });
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("pool_count", ({ count }: { count: number }) => setPoolCount(count));
    socket.on(
      "slot_filled",
      ({ slot, suitorName }: { slot: number; suitorName: string }) => {
        onSlotFilledRef.current(slot, suitorName);
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token]);

  return { isConnected, poolCount };
}

// ─── Room socket (chat) ───────────────────────────────────────────────────────

interface RoomSocketOptions {
  roomId: string | undefined;
  participantId: string | undefined;
  senderName: string | undefined;
  senderRole: "chooser" | "suitor" | undefined;
  token?: string;
  onMessage: (msg: Message) => void;
  onRoomUpdated: (room: Room) => void;
  onSessionEnded: (data: { winnerId: string; winnerName: string }) => void;
  onSuitorEliminated?: (data: { participantId: string }) => void;
  onRoundAdvanced?: (data: { round: number }) => void;
}

export function useRoomSocket({
  roomId,
  participantId,
  senderName,
  senderRole,
  token,
  onMessage,
  onRoomUpdated,
  onSessionEnded,
  onSuitorEliminated,
  onRoundAdvanced,
}: RoomSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onRoomUpdatedRef = useRef(onRoomUpdated);
  const onSessionEndedRef = useRef(onSessionEnded);
  const onSuitorEliminatedRef = useRef(onSuitorEliminated);
  const onRoundAdvancedRef = useRef(onRoundAdvanced);
  onMessageRef.current = onMessage;
  onRoomUpdatedRef.current = onRoomUpdated;
  onSessionEndedRef.current = onSessionEnded;
  onSuitorEliminatedRef.current = onSuitorEliminated;
  onRoundAdvancedRef.current = onRoundAdvanced;

  useEffect(() => {
    if (!roomId || !participantId) return;

    const socket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_room", { roomId, participantId, ...(token ? { token } : {}) });
    });
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("message_received", (msg: Message) => onMessageRef.current(msg));
    socket.on("room_updated", (room: Room) => onRoomUpdatedRef.current(room));
    socket.on("session_started", (room: Room) => onRoomUpdatedRef.current(room));
    socket.on(
      "session_ended",
      (data: { winnerId: string; winnerName: string }) =>
        onSessionEndedRef.current(data),
    );
    socket.on("suitor_eliminated", (data: { participantId: string }) => {
      onSuitorEliminatedRef.current?.(data);
    });
    socket.on("round_advanced", (data: { round: number }) => {
      onRoundAdvancedRef.current?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, participantId, token]);

  const sendMessage = useCallback(
    (content: string, suitorSlot: number | null, round?: number) => {
      if (
        !socketRef.current?.connected ||
        !roomId ||
        !participantId ||
        !senderName ||
        !senderRole
      )
        return;
      socketRef.current.emit("send_message", {
        roomId,
        participantId,
        senderName,
        senderRole,
        content,
        suitorSlot,
        round,
      });
    },
    [roomId, participantId, senderName, senderRole],
  );

  return { isConnected, sendMessage };
}
