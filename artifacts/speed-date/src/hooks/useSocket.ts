import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Room } from '@workspace/api-client-react';

interface ServerToClientEvents {
  message_received: (msg: Message) => void;
  room_updated: (room: Room) => void;
  session_started: (room: Room) => void;
  countdown_started: (data: { roomId: string; startsAt: string; round: number; roomSnapshotVersion: number }) => void;
  round_started: (data: { roomId: string; round: number; endsAt: string | null; roomSnapshotVersion: number }) => void;
  timer_sync: (data: { roomId: string; endsAt: string | null; roomSnapshotVersion: number }) => void;
  session_ended: (data: { winnerId: string | null; winnerName: string | null; reason?: string; roomSnapshotVersion: number }) => void;
  match_found: (data: { roomId: string; participantId: string }) => void;
  slot_filled: (data: { slot: number; suitorName: string; participantId: string; roomId: string }) => void;
  pool_count: (data: { count: number }) => void;
  suitor_eliminated: (data: { participantId: string; roomSnapshotVersion: number }) => void;
  round_advanced: (data: { round: number; roomSnapshotVersion: number }) => void;
}

interface ClientToServerEvents {
  join_room: (data: { roomId: string; participantId: string; token?: string }) => void;
  enter_pool: (data: { userId: string; token?: string }) => void;
  chooser_waiting: (data: { userId: string; token?: string }) => void;
  leave_pool: (data: { userId: string }) => void;
  send_message: (data: {
    roomId: string;
    participantId: string;
    senderName: string;
    senderRole: 'chooser' | 'suitor';
    content: string;
    suitorSlot: number | null;
    round?: number;
  }) => void;
}

export function useSocket(
  roomId?: string,
  participantId?: string,
  senderName?: string,
  senderRole?: 'chooser' | 'suitor',
  token?: string,
  snapshotVersion?: number,
) {
    const shouldLogStaleEvents = process.env.NODE_ENV !== 'production';
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const latestSnapshotVersionRef = useRef(snapshotVersion ?? 0);

  useEffect(() => {
    latestSnapshotVersionRef.current = snapshotVersion ?? 0;
  }, [snapshotVersion]);

  const isFreshSnapshot = useCallback((version?: number) => {
    if (typeof version !== 'number') return true;
    return version >= latestSnapshotVersionRef.current;
  }, []);

  const updateSnapshotVersion = useCallback((version?: number) => {
    if (typeof version === 'number' && version > latestSnapshotVersionRef.current) {
      latestSnapshotVersionRef.current = version;
    }
  }, []);

  const isVersionedEventFresh = useCallback((event: keyof ServerToClientEvents, payload: unknown) => {
    if (event === 'room_updated' || event === 'session_started') {
      const room = payload as Room;
      if (!isFreshSnapshot(room.roomSnapshotVersion)) {
        if (shouldLogStaleEvents) {
          console.warn('Dropped stale room snapshot event', { event, incomingVersion: room.roomSnapshotVersion, currentVersion: latestSnapshotVersionRef.current });
        }
        return false;
      }
      updateSnapshotVersion(room.roomSnapshotVersion);
      return true;
    }
    if (event === 'countdown_started' || event === 'round_started' || event === 'timer_sync') {
      const versioned = payload as { roomSnapshotVersion?: number };
      if (!isFreshSnapshot(versioned.roomSnapshotVersion)) {
        if (shouldLogStaleEvents) {
          console.warn('Dropped stale lifecycle event', { event, incomingVersion: versioned.roomSnapshotVersion, currentVersion: latestSnapshotVersionRef.current });
        }
        return false;
      }
      updateSnapshotVersion(versioned.roomSnapshotVersion);
      return true;
    }
    if (event === 'suitor_eliminated' || event === 'round_advanced' || event === 'session_ended') {
      const versioned = payload as { roomSnapshotVersion?: number };
      if (!isFreshSnapshot(versioned.roomSnapshotVersion)) {
        if (shouldLogStaleEvents) {
          console.warn('Dropped stale terminal event', { event, incomingVersion: versioned.roomSnapshotVersion, currentVersion: latestSnapshotVersionRef.current });
        }
        return false;
      }
      updateSnapshotVersion(versioned.roomSnapshotVersion);
      return true;
    }
    return true;
  }, [isFreshSnapshot, shouldLogStaleEvents, updateSnapshotVersion]);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, participantId, ...(token ? { token } : {}) });
    };

    if (socket.connected) onConnect();

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('room_updated', (room) => {
      if (!isFreshSnapshot(room.roomSnapshotVersion)) return;
      updateSnapshotVersion(room.roomSnapshotVersion);
    });
    socket.on('session_started', (room) => {
      if (!isFreshSnapshot(room.roomSnapshotVersion)) return;
      updateSnapshotVersion(room.roomSnapshotVersion);
    });
    socket.on('countdown_started', ({ roomSnapshotVersion }) => {
      if (!isFreshSnapshot(roomSnapshotVersion)) return;
      updateSnapshotVersion(roomSnapshotVersion);
    });
    socket.on('round_started', ({ roomSnapshotVersion }) => {
      if (!isFreshSnapshot(roomSnapshotVersion)) return;
      updateSnapshotVersion(roomSnapshotVersion);
    });
    socket.on('timer_sync', ({ roomSnapshotVersion }) => {
      if (!isFreshSnapshot(roomSnapshotVersion)) return;
      updateSnapshotVersion(roomSnapshotVersion);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, participantId, token]);

  const sendMessage = useCallback(
    (content: string, suitorSlot: number | null, round?: number) => {
      if (socketRef.current && isConnected && roomId && participantId && senderName && senderRole) {
        socketRef.current.emit('send_message', { roomId, participantId, senderName, senderRole, content, suitorSlot, round });
      }
    },
    [isConnected, roomId, participantId, senderName, senderRole],
  );

  const subscribe = useCallback(
    <K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
      const socket = socketRef.current;
      if (!socket) {
        return () => {};
      }
      const wrapped = ((payload: Parameters<ServerToClientEvents[K]>[0]) => {
        if (!isVersionedEventFresh(event, payload)) return;
        (callback as any)(payload);
      }) as ServerToClientEvents[K];
      socket.on(event, wrapped as any);
      return () => { if (socketRef.current) socketRef.current.off(event, wrapped as any); };
    },
    [isVersionedEventFresh],
  );

  return { isConnected, sendMessage, subscribe, socket: socketRef.current };
}

export function usePoolSocket(userId?: string, token?: string) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [poolCount, setPoolCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('enter_pool', { userId, ...(token ? { token } : {}) });
    };

    if (socket.connected) onConnect();

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('pool_count', ({ count }) => setPoolCount(count));

    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('leave_pool', { userId });
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId, token]);

  const leavePool = useCallback(() => {
    if (socketRef.current?.connected && userId) {
      socketRef.current.emit('leave_pool', { userId });
    }
  }, [userId]);

  const subscribe = useCallback(
    <K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
      const socket = socketRef.current;
      if (socket) socket.on(event, callback as any);
      return () => { if (socketRef.current) socketRef.current.off(event, callback as any); };
    },
    [],
  );

  return { isConnected, poolCount, leavePool, subscribe };
}

export function useChooserSocket(userId?: string, token?: string) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [poolCount, setPoolCount] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('chooser_waiting', { userId, ...(token ? { token } : {}) });
    };

    if (socket.connected) onConnect();

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('pool_count', ({ count }) => setPoolCount(count));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId, token]);

  const subscribe = useCallback(
    <K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
      const socket = socketRef.current;
      if (socket) socket.on(event, callback as any);
      return () => { if (socketRef.current) socketRef.current.off(event, callback as any); };
    },
    [],
  );

  return { isConnected, poolCount, subscribe };
}
