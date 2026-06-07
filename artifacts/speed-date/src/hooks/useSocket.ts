import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Room } from '@workspace/api-client-react';

interface ServerToClientEvents {
  message_received: (msg: Message) => void;
  room_updated: (room: Room) => void;
  session_started: (room: Room) => void;
  session_ended: (data: { winnerId: string; winnerName: string }) => void;
  match_found: (data: { roomId: string; participantId: string }) => void;
  slot_filled: (data: { slot: number; suitorName: string; participantId: string; roomId: string }) => void;
}

interface ClientToServerEvents {
  join_room: (data: { roomId: string; participantId: string }) => void;
  enter_pool: (data: { userId: string }) => void;
  chooser_waiting: (data: { userId: string }) => void;
  leave_pool: (data: { userId: string }) => void;
  send_message: (data: {
    roomId: string;
    participantId: string;
    senderName: string;
    senderRole: 'chooser' | 'suitor';
    content: string;
    suitorSlot: number | null;
  }) => void;
}

export function useSocket(roomId?: string, participantId?: string, senderName?: string, senderRole?: 'chooser' | 'suitor') {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    if (!roomId || !participantId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, participantId });
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, participantId]);

  const sendMessage = useCallback((content: string, suitorSlot: number | null) => {
    if (socketRef.current && isConnected && roomId && participantId && senderName && senderRole) {
      socketRef.current.emit('send_message', {
        roomId,
        participantId,
        senderName,
        senderRole,
        content,
        suitorSlot,
      });
    }
  }, [isConnected, roomId, participantId, senderName, senderRole]);

  const subscribe = useCallback(<K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
    const socket = socketRef.current;
    if (socket) {
      socket.on(event, callback as any);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback as any);
      }
    };
  }, []);

  return { isConnected, sendMessage, subscribe, socket: socketRef.current };
}

// Hook for suitors waiting in the pool
export function usePoolSocket(userId?: string) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('enter_pool', { userId });
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      if (socketRef.current?.connected) {
        socketRef.current.emit('leave_pool', { userId });
      }
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  const subscribe = useCallback(<K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
    const socket = socketRef.current;
    if (socket) {
      socket.on(event, callback as any);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback as any);
      }
    };
  }, []);

  return { isConnected, subscribe };
}

// Hook for choosers waiting for auto-match results
export function useChooserSocket(userId?: string) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const socket = io({ path: '/ws/socket.io' });
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      socket.emit('chooser_waiting', { userId });
    };

    if (socket.connected) {
      onConnect();
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  const subscribe = useCallback(<K extends keyof ServerToClientEvents>(event: K, callback: ServerToClientEvents[K]) => {
    const socket = socketRef.current;
    if (socket) {
      socket.on(event, callback as any);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback as any);
      }
    };
  }, []);

  return { isConnected, subscribe };
}
