import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message, Room } from '@workspace/api-client-react';

interface ServerToClientEvents {
  message_received: (msg: Message) => void;
  room_updated: (room: Room) => void;
  session_started: (room: Room) => void;
  session_ended: (data: { winnerId: string; winnerName: string }) => void;
}

interface ClientToServerEvents {
  join_room: (data: { roomId: string; participantId: string }) => void;
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

    const socket = io({
      path: '/ws/socket.io',
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_room', { roomId, participantId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

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

  return {
    isConnected,
    sendMessage,
    subscribe,
    socket: socketRef.current,
  };
}
