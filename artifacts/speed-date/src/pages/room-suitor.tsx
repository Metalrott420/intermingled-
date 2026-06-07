import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetRoom, useGetRoomMessages, getGetRoomQueryKey, getGetRoomMessagesQueryKey } from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const ROUND_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "FINAL" };
const SESSION_KEY = "intermingled_last_user";

export default function RoomSuitor() {
  const params = useParams();
  const roomId = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isEliminated, setIsEliminated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // For the "Rejoin Pool" button after elimination
  const lastUser = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as { id: string; name: string }) : null;
    } catch { return null; }
  }, []);

  const { data: room, isLoading: isLoadingRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) },
  });
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) },
  });

  const myParticipant = room?.participants.find((p) => p.id === participantId);
  const myParticipantName = myParticipant?.name;
  const currentRound = room?.currentRound ?? 1;

  const { isConnected, sendMessage, subscribe } = useSocket(
    roomId,
    participantId || undefined,
    myParticipantName,
    "suitor",
  );

  useEffect(() => {
    if (!participantId) setLocation("/");
  }, [participantId, setLocation]);

  useEffect(() => {
    if (initialMessages && participantId) {
      setMessages(
        initialMessages.filter((m) => m.suitorSlot === (myParticipant?.suitorSlot ?? null)),
      );
    }
  }, [initialMessages, participantId, myParticipant?.suitorSlot]);

  useEffect(() => {
    const unsubMsg = subscribe("message_received", (msg) => {
      if (myParticipant && msg.suitorSlot === myParticipant.suitorSlot) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    const unsubRoom = subscribe("room_updated", (updatedRoom) => {
      queryClient.setQueryData(getGetRoomQueryKey(roomId), updatedRoom);
    });
    const unsubSessionEnded = subscribe("session_ended", () => {
      setLocation(`/result/${roomId}`);
    });
    const unsubEliminated = subscribe("suitor_eliminated", ({ participantId: eliminatedId }) => {
      if (eliminatedId === participantId) setIsEliminated(true);
    });

    return () => { unsubMsg(); unsubRoom(); unsubSessionEnded(); unsubEliminated(); };
  }, [subscribe, roomId, setLocation, queryClient, myParticipant, participantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isActive = room?.status === "active";
  const isEnded = room?.status === "ended";

  if (isEnded) {
    setLocation(`/result/${roomId}`);
    return null;
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isEliminated) return;
    sendMessage(inputValue, myParticipant?.suitorSlot ?? null, currentRound);
    setInputValue("");
  };

  if (isLoadingRoom || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">
        LOADING DATABANKS...
      </div>
    );
  }

  // ── Elimination screen ───────────────────────────────────────────────────────
  if (isEliminated) {
    const poolUrl = lastUser
      ? `/pool?userId=${lastUser.id}&name=${encodeURIComponent(lastUser.name)}`
      : null;

    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full border border-destructive/20 rounded-2xl bg-card/60 backdrop-blur p-10 space-y-5">
          <div className="text-6xl font-black text-destructive/30">✕</div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-destructive">ELIMINATED</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="font-bold text-foreground">{room.chooserName}</span> has made their decision.
            You were cut after Round {ROUND_LABELS[currentRound] ?? currentRound}.
          </p>
          <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
            Shake it off — the pool awaits
          </p>

          <div className="pt-2 space-y-3">
            {poolUrl && (
              <Button
                onClick={() => setLocation(poolUrl)}
                className="w-full h-12 font-bold uppercase tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_0_20px_hsl(var(--secondary)/0.3)]"
              >
                ↩ Rejoin Pool
              </Button>
            )}
            <Link href="/">
              <Button
                variant="outline"
                className="w-full h-11 font-bold uppercase tracking-widest border-border hover:border-primary/50 hover:text-primary"
              >
                {poolUrl ? "Start Fresh" : "Play Again"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl h-[calc(100dvh-1.5rem)] sm:h-[82dvh] border border-secondary/30 rounded-xl flex flex-col bg-card shadow-[0_0_30px_hsl(var(--secondary)/0.12)] overflow-hidden">
        {/* Header */}
        <header className="p-3 sm:p-4 border-b border-border bg-secondary/10 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-base sm:text-xl font-bold text-secondary uppercase tracking-widest">
              {room.chooserName}'s Room
            </h1>
            {myParticipant && (
              <div className="text-xs font-mono text-muted-foreground">
                YOU: <span className="text-secondary">{myParticipant.name.toUpperCase()}</span>
                {myParticipant.suitorSlot != null && (
                  <span className="ml-2 opacity-50">· SLOT {myParticipant.suitorSlot}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <div className="text-center border-r border-border pr-3">
                <div className="text-[9px] uppercase text-muted-foreground font-mono">Round</div>
                <div className={`font-black text-lg leading-none ${currentRound === 4 ? "text-primary" : "text-secondary"}`}>
                  {ROUND_LABELS[currentRound] ?? currentRound}
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground font-mono">Status</div>
              <div className={`font-bold uppercase text-sm ${isActive ? "text-primary animate-pulse" : "text-muted-foreground"}`}>
                {isActive ? "LIVE" : "WAITING"}
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-secondary animate-pulse" : "bg-muted-foreground"}`} />
          </div>
        </header>

        {/* Round info strip */}
        {isActive && (
          <div className="px-4 py-1.5 bg-secondary/5 border-b border-border/40 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">
              {currentRound <= 3
                ? `${6 - currentRound} suitors active · 1 question this round`
                : "Finals · 3 questions · Show them who you are"}
            </span>
          </div>
        )}

        {/* Body */}
        <main className="flex-1 overflow-hidden relative">
          {!isActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-muted border-t-secondary animate-spin mb-6" />
              <h2 className="text-xl sm:text-2xl font-bold uppercase mb-2">Waiting to start</h2>
              <p className="text-muted-foreground font-mono text-sm">{room.suitorCount} / 5 suitors joined</p>
              <p className="text-xs text-muted-foreground/60 font-mono mt-2">Session starts when all 5 slots fill</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1 p-3 sm:p-5">
                <div className="flex flex-col gap-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground font-mono text-xs">
                      WAITING FOR {room.chooserName?.toUpperCase()}'S QUESTION...
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isMine = msg.senderId === participantId;
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[78%] sm:max-w-[70%] rounded-lg p-2.5 sm:p-3 text-sm ${
                          isMine
                            ? "bg-secondary/20 text-secondary-foreground border border-secondary/50 self-end"
                            : "bg-primary/20 text-primary-foreground border border-primary/50 self-start"
                        }`}
                      >
                        <div className="text-[10px] font-mono opacity-50 mb-1">
                          {isMine ? "YOU" : room.chooserName}
                        </div>
                        {msg.content}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-3 sm:p-4 border-t border-border shrink-0 bg-background/80">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Your answer..."
                    className="h-11 sm:h-12 bg-input border-border focus-visible:ring-secondary text-sm sm:text-base"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 sm:h-12 px-4 sm:px-8 font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0"
                  >
                    SEND
                  </Button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
