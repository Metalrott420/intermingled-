import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetRoom, useGetRoomMessages, getGetRoomQueryKey, getGetRoomMessagesQueryKey } from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function RoomSuitor() {
  const params = useParams();
  const roomId = params.id as string;
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  
  const { data: room, isLoading: isLoadingRoom } = useGetRoom(roomId, { 
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) } 
  });
  
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) }
  });

  const myParticipantName = room?.participants.find(p => p.id === participantId)?.name;
  const { isConnected, sendMessage, subscribe } = useSocket(roomId, participantId || undefined, myParticipantName, 'suitor');

  useEffect(() => {
    if (!participantId) {
      setLocation("/lobby");
    }
  }, [participantId, setLocation]);

  useEffect(() => {
    if (initialMessages && participantId) {
      // Filter to only this suitor's messages and chooser messages directed to them
      const myParticipant = room?.participants.find(p => p.id === participantId);
      if (myParticipant) {
        setMessages(initialMessages.filter(m => m.suitorSlot === myParticipant.suitorSlot));
      }
    }
  }, [initialMessages, participantId, room]);

  useEffect(() => {
    const unsubMsg = subscribe("message_received", (msg) => {
      const myParticipant = room?.participants.find(p => p.id === participantId);
      // Only process messages for my slot
      if (myParticipant && msg.suitorSlot === myParticipant.suitorSlot) {
        setMessages(prev => [...prev, msg]);
      }
    });
    
    const unsubRoom = subscribe("room_updated", (updatedRoom) => {
      queryClient.setQueryData(getGetRoomQueryKey(roomId), updatedRoom);
    });

    const unsubSessionEnded = subscribe("session_ended", () => {
      setLocation(`/result/${roomId}`);
    });

    return () => {
      unsubMsg();
      unsubRoom();
      unsubSessionEnded();
    };
  }, [subscribe, roomId, setLocation, queryClient, room, participantId]);

  const isActive = room?.status === 'active';
  const isEnded = room?.status === 'ended';

  if (isEnded) {
    setLocation(`/result/${roomId}`);
    return null;
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    
    const myParticipant = room?.participants.find(p => p.id === participantId);
    if (myParticipant) {
      sendMessage(inputValue, myParticipant.suitorSlot);
      setInputValue("");
    }
  };

  if (isLoadingRoom || !room) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">LOADING DATABANKS...</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[80dvh] border border-secondary/30 rounded-lg flex flex-col bg-card shadow-[0_0_30px_hsl(var(--secondary)/0.15)] overflow-hidden">
        <header className="p-4 border-b border-border bg-secondary/10 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-xl font-bold text-secondary uppercase tracking-widest">{room.chooserName}'s Room</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground font-mono">Status</div>
              <div className={`font-bold uppercase ${isActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}>
                {isActive ? 'LIVE' : 'WAITING'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {!isActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-24 h-24 rounded-full border-4 border-muted border-t-secondary animate-spin mb-8"></div>
              <h2 className="text-2xl font-bold uppercase mb-2">Waiting for the host</h2>
              <p className="text-muted-foreground font-mono">{room.suitorCount} / 5 SUITORS JOINED</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1 p-6">
                <div className="flex flex-col gap-4 justify-end min-h-full">
                  {messages.map(msg => {
                    const isMine = msg.senderId === participantId;
                    return (
                      <div key={msg.id} className={`max-w-[70%] rounded p-3 text-base ${isMine ? 'bg-secondary/20 text-secondary-foreground border border-secondary/50 self-end' : 'bg-primary/20 text-primary-foreground border border-primary/50 self-start'}`}>
                        <div className="text-xs font-mono opacity-50 mb-1">{isMine ? 'YOU' : room.chooserName}</div>
                        {msg.content}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              <div className="p-4 border-t border-border shrink-0 bg-background">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input 
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Send a message to stand out..."
                    className="h-12 bg-input border-border focus-visible:ring-secondary text-lg"
                  />
                  <Button type="submit" size="lg" className="h-12 px-8 font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80">SEND</Button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
