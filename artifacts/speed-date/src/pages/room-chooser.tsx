import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetRoom, useGetRoomMessages, useChooseWinner, getGetRoomQueryKey, getGetRoomMessagesQueryKey } from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message, Room } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function RoomChooser() {
  const params = useParams();
  const roomId = params.id as string;
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);
  
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  
  // Queries
  const { data: room, isLoading: isLoadingRoom } = useGetRoom(roomId, { 
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) } 
  });
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) }
  });
  
  const chooseWinner = useChooseWinner();

  const chooserName = room?.chooserName ?? undefined;

  // Socket
  const { isConnected, sendMessage, subscribe } = useSocket(roomId, participantId || undefined, chooserName, 'chooser');

  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  useEffect(() => {
    if (!participantId) {
      setLocation("/");
    }
  }, [participantId, setLocation]);

  useEffect(() => {
    const unsubMsg = subscribe("message_received", (msg) => {
      setMessages(prev => [...prev, msg]);
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
  }, [subscribe, roomId, setLocation, queryClient]);

  // Derived state
  const isActive = room?.status === 'active';
  const isEnded = room?.status === 'ended';

  if (isEnded) {
    setLocation(`/result/${roomId}`);
    return null;
  }

  const handleSend = (slot: number) => {
    const content = inputValues[slot];
    if (!content?.trim()) return;
    
    sendMessage(content, slot);
    setInputValues(prev => ({ ...prev, [slot]: "" }));
  };

  const handleChoose = (winnerId: string) => {
    chooseWinner.mutate({ id: roomId, data: { winnerId } });
  };

  if (isLoadingRoom || !room) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">LOADING DATABANKS...</div>;
  }

  const suitorSlots = [1, 2, 3, 4, 5];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="p-4 border-b border-border bg-card/50 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_hsl(var(--primary))]">FlirtFest</h1>
          <div className="text-xs font-mono text-muted-foreground">ROOM CODE: <span className="text-secondary">{room.code}</span></div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs uppercase text-muted-foreground font-mono">Status</div>
            <div className={`font-bold uppercase ${isActive ? 'text-secondary animate-pulse' : 'text-primary'}`}>
              {isActive ? 'LIVE' : 'WAITING'}
            </div>
          </div>
          <div className="text-center border-l border-border pl-6">
            <div className="text-xs uppercase text-muted-foreground font-mono">Suitors</div>
            <div className="font-bold font-mono text-lg">{room.suitorCount} / 5</div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col">
        {!isActive ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-4xl font-black uppercase text-muted-foreground mb-4">Waiting for challengers</div>
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`w-16 h-16 rounded border-2 flex items-center justify-center transition-all ${i < room.suitorCount ? 'border-secondary bg-secondary/20 shadow-[0_0_15px_hsl(var(--secondary)/0.3)]' : 'border-border bg-card'}`}>
                  {i < room.suitorCount ? <span className="text-secondary font-bold">READY</span> : <span className="text-muted-foreground">EMPTY</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-5 gap-4 overflow-hidden">
            {suitorSlots.map((slot) => {
              const suitor = room.participants.find(p => p.suitorSlot === slot);
              const slotMessages = messages.filter(m => m.suitorSlot === slot);
              
              if (!suitor) {
                return (
                  <div key={slot} className="border border-border/50 rounded flex flex-col items-center justify-center bg-card/30">
                    <span className="text-muted-foreground font-mono text-xs">NO CONNECTION</span>
                  </div>
                );
              }

              return (
                <div key={slot} className="border border-secondary/30 rounded flex flex-col bg-card/50 shadow-[0_0_10px_hsl(var(--secondary)/0.1)] relative overflow-hidden group hover:border-secondary hover:shadow-[0_0_20px_hsl(var(--secondary)/0.3)] transition-all">
                  <div className="p-3 border-b border-secondary/30 bg-secondary/10 flex justify-between items-center shrink-0">
                    <span className="font-bold text-secondary uppercase truncate">{suitor.name}</span>
                  </div>
                  
                  <ScrollArea className="flex-1 p-3">
                    <div className="flex flex-col gap-3 justify-end min-h-full">
                      {slotMessages.map(msg => {
                        const isMine = msg.senderRole === 'chooser';
                        return (
                          <div key={msg.id} className={`max-w-[85%] rounded p-2 text-sm ${isMine ? 'bg-primary/20 text-primary-foreground border border-primary/50 self-end' : 'bg-secondary/20 text-secondary-foreground border border-secondary/50 self-start'}`}>
                            {msg.content}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <div className="p-3 border-t border-border shrink-0 bg-background/50">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(slot); }} className="flex gap-2">
                      <Input 
                        value={inputValues[slot] || ""}
                        onChange={e => setInputValues(prev => ({ ...prev, [slot]: e.target.value }))}
                        placeholder="Message..."
                        className="h-8 text-sm bg-input border-border focus-visible:ring-secondary"
                      />
                      <Button type="submit" size="sm" className="h-8 bg-secondary text-secondary-foreground hover:bg-secondary/80">SEND</Button>
                    </form>
                  </div>
                  
                  <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10">
                    <Button 
                      size="lg" 
                      onClick={() => handleChoose(suitor.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest shadow-[0_0_30px_hsl(var(--primary)/0.5)] border border-primary/50 scale-110"
                    >
                      CHOOSE {suitor.name}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
