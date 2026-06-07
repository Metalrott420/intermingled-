import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGetRoom,
  useGetRoomMessages,
  useChooseWinner,
  getGetRoomQueryKey,
  getGetRoomMessagesQueryKey,
} from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function RoomChooser() {
  const params = useParams();
  const roomId = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState(1);
  // Track unread counts per slot (for inactive tabs)
  const [unread, setUnread] = useState<Record<number, number>>({});
  const messageEndRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { data: room, isLoading: isLoadingRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) },
  });
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) },
  });

  const chooseWinner = useChooseWinner();
  const chooserName = room?.chooserName ?? undefined;
  const { sendMessage, subscribe } = useSocket(roomId, participantId || undefined, chooserName, "chooser");

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!participantId) setLocation("/");
  }, [participantId, setLocation]);

  useEffect(() => {
    const unsubMsg = subscribe("message_received", (msg) => {
      setMessages((prev) => [...prev, msg]);
      // If message is in a slot the chooser isn't currently viewing, increment unread
      if (msg.senderRole === "suitor" && msg.suitorSlot != null) {
        setUnread((prev) => {
          const slot = msg.suitorSlot as number;
          // Will compare against activeTab inside the updater
          return prev; // handled below via slot ref
        });
        setActiveTab((current) => {
          if (msg.suitorSlot !== current) {
            setUnread((prev) => ({
              ...prev,
              [msg.suitorSlot as number]: (prev[msg.suitorSlot as number] ?? 0) + 1,
            }));
          }
          return current;
        });
      }
    });

    const unsubRoom = subscribe("room_updated", (updatedRoom) => {
      queryClient.setQueryData(getGetRoomQueryKey(roomId), updatedRoom);
    });

    const unsubSessionEnded = subscribe("session_ended", () => {
      setLocation(`/result/${roomId}`);
    });

    return () => { unsubMsg(); unsubRoom(); unsubSessionEnded(); };
  }, [subscribe, roomId, setLocation, queryClient]);

  // Scroll to bottom when messages change in the active tab
  useEffect(() => {
    messageEndRefs.current[activeTab]?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const handleTabChange = (slot: number) => {
    setActiveTab(slot);
    setUnread((prev) => ({ ...prev, [slot]: 0 }));
  };

  const isActive = room?.status === "active";
  const isEnded = room?.status === "ended";

  if (isEnded) {
    setLocation(`/result/${roomId}`);
    return null;
  }

  const handleSend = (slot: number) => {
    const content = inputValues[slot];
    if (!content?.trim()) return;
    sendMessage(content, slot);
    setInputValues((prev) => ({ ...prev, [slot]: "" }));
  };

  const handleChoose = (winnerId: string) => {
    chooseWinner.mutate({ id: roomId, data: { winnerId } });
  };

  if (isLoadingRoom || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">
        LOADING DATABANKS...
      </div>
    );
  }

  const suitorSlots = [1, 2, 3, 4, 5];

  const SlotPanel = ({ slot }: { slot: number }) => {
    const suitor = room.participants.find((p) => p.suitorSlot === slot);
    const slotMessages = messages.filter((m) => m.suitorSlot === slot);

    if (!suitor) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center border border-border/50 rounded bg-card/30">
          <span className="text-muted-foreground font-mono text-xs">NO CONNECTION</span>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col border border-secondary/30 rounded bg-card/50 shadow-[0_0_10px_hsl(var(--secondary)/0.1)] relative overflow-hidden group hover:border-secondary hover:shadow-[0_0_20px_hsl(var(--secondary)/0.3)] transition-all">
        {/* Suitor header */}
        <div className="p-2 sm:p-3 border-b border-secondary/30 bg-secondary/10 flex justify-between items-center shrink-0">
          <span className="font-bold text-secondary uppercase truncate text-sm">{suitor.name}</span>
          <span className="text-xs font-mono text-muted-foreground hidden sm:block">#{slot}</span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-2 sm:p-3">
          <div className="flex flex-col gap-2 sm:gap-3">
            {slotMessages.map((msg) => {
              const isMine = msg.senderRole === "chooser";
              return (
                <div
                  key={msg.id}
                  className={`max-w-[88%] rounded p-2 text-xs sm:text-sm ${
                    isMine
                      ? "bg-primary/20 text-primary-foreground border border-primary/50 self-end"
                      : "bg-secondary/20 text-secondary-foreground border border-secondary/50 self-start"
                  }`}
                >
                  {msg.content}
                </div>
              );
            })}
            <div ref={(el) => { messageEndRefs.current[slot] = el; }} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-2 sm:p-3 border-t border-border shrink-0 bg-background/50">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(slot); }}
            className="flex gap-1.5 sm:gap-2"
          >
            <Input
              value={inputValues[slot] || ""}
              onChange={(e) => setInputValues((prev) => ({ ...prev, [slot]: e.target.value }))}
              placeholder="Message..."
              className="h-8 text-xs sm:text-sm bg-input border-border focus-visible:ring-secondary"
            />
            <Button type="submit" size="sm" className="h-8 px-2 sm:px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs">
              SEND
            </Button>
          </form>
        </div>

        {/* Hover to choose overlay — hidden on mobile, shown on hover on desktop */}
        <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10 hidden sm:flex">
          <Button
            size="lg"
            onClick={() => handleChoose(suitor.id)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold uppercase tracking-widest shadow-[0_0_30px_hsl(var(--primary)/0.5)] border border-primary/50"
          >
            CHOOSE {suitor.name}
          </Button>
        </div>

        {/* Mobile choose button (always visible at bottom on mobile) */}
        <div className="sm:hidden p-2 border-t border-primary/20 bg-primary/5">
          <Button
            size="sm"
            onClick={() => handleChoose(suitor.id)}
            className="w-full h-8 bg-primary/20 text-primary border border-primary/40 hover:bg-primary hover:text-primary-foreground font-bold uppercase tracking-widest text-xs transition-all"
          >
            Choose {suitor.name}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="p-3 sm:p-4 border-b border-border bg-card/50 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_hsl(var(--primary))]">
            FlirtFest
          </h1>
          <div className="text-xs font-mono text-muted-foreground">
            ROOM: <span className="text-secondary">{room.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="text-center">
            <div className="text-xs uppercase text-muted-foreground font-mono">Status</div>
            <div className={`font-bold uppercase text-sm ${isActive ? "text-secondary animate-pulse" : "text-primary"}`}>
              {isActive ? "LIVE" : "WAITING"}
            </div>
          </div>
          <div className="text-center border-l border-border pl-3 sm:pl-6">
            <div className="text-xs uppercase text-muted-foreground font-mono">Suitors</div>
            <div className="font-bold font-mono">{room.suitorCount} / 5</div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!isActive ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="text-2xl sm:text-4xl font-black uppercase text-muted-foreground mb-6 text-center">
              Waiting for challengers
            </div>
            <div className="flex gap-2 sm:gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded border-2 flex items-center justify-center transition-all ${
                    i < room.suitorCount
                      ? "border-secondary bg-secondary/20 shadow-[0_0_15px_hsl(var(--secondary)/0.3)]"
                      : "border-border bg-card"
                  }`}
                >
                  <span className={`text-xs font-bold ${i < room.suitorCount ? "text-secondary" : "text-muted-foreground"}`}>
                    {i < room.suitorCount ? "READY" : String(i + 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── MOBILE: tab bar ── */}
            <div className="sm:hidden flex border-b border-border shrink-0 bg-card/30 overflow-x-auto">
              {suitorSlots.map((slot) => {
                const suitor = room.participants.find((p) => p.suitorSlot === slot);
                const count = unread[slot] ?? 0;
                return (
                  <button
                    key={slot}
                    onClick={() => handleTabChange(slot)}
                    className={`flex-1 min-w-[60px] py-2.5 px-1 text-xs font-bold uppercase font-mono relative transition-colors ${
                      activeTab === slot
                        ? "text-secondary border-b-2 border-secondary bg-secondary/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {suitor ? suitor.name.slice(0, 6) : `#${slot}`}
                    {count > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-black">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── MOBILE: single active panel ── */}
            <div className="sm:hidden flex-1 flex flex-col overflow-hidden p-2">
              <SlotPanel slot={activeTab} />
            </div>

            {/* ── DESKTOP: 5 column grid ── */}
            <div className="hidden sm:grid flex-1 grid-cols-5 gap-3 p-3 overflow-hidden">
              {suitorSlots.map((slot) => (
                <SlotPanel key={slot} slot={slot} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
