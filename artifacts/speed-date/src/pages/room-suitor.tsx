import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetRoom, useGetRoomMessages, getGetRoomQueryKey, getGetRoomMessagesQueryKey } from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap, Send } from "lucide-react";

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
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const { getToken } = useAuth();
  const [socketToken, setSocketToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setSocketToken(t)).catch(() => {});
  }, [getToken]);

  const { isConnected, sendMessage, subscribe } = useSocket(
    roomId, participantId || undefined, myParticipantName, "suitor", socketToken ?? undefined,
  );

  useEffect(() => { if (!participantId) setLocation("/"); }, [participantId, setLocation]);

  useEffect(() => {
    if (initialMessages && participantId) {
      setMessages(initialMessages.filter((m) => m.suitorSlot === (myParticipant?.suitorSlot ?? null)));
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
    const unsubEliminated = subscribe("suitor_eliminated", ({ participantId: eliminatedId }: { participantId: string }) => {
      if (eliminatedId === participantId) setIsEliminated(true);
    });
    return () => { unsubMsg(); unsubRoom(); unsubSessionEnded(); unsubEliminated(); };
  }, [subscribe, roomId, setLocation, queryClient, myParticipant, participantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isActive = room?.status === "active";
  const isEnded = room?.status === "ended";

  if (isEnded) { setLocation(`/result/${roomId}`); return null; }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isEliminated) return;
    sendMessage(inputValue, myParticipant?.suitorSlot ?? null, currentRound);
    setInputValue("");
  };

  if (isLoadingRoom || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background stage-bg">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-lg font-black uppercase tracking-widest text-primary animate-pulse">
            LOADING DATABANKS...
          </div>
        </div>
      </div>
    );
  }

  // ── Elimination screen ────────────────────────────────────────────────────
  if (isEliminated) {
    const poolUrl = lastUser
      ? `/pool?userId=${lastUser.id}&name=${encodeURIComponent(lastUser.name)}`
      : null;

    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center spotlight-bg relative overflow-hidden">
        <div className="stage-light-1 pointer-events-none" />

        <div className="max-w-md w-full gameshow-card p-10 space-y-5 relative z-10 elim-flash border-elimination/30">
          <div className="text-8xl font-display font-black text-elimination/40 drop-shadow-[0_0_30px_hsl(var(--elimination)/0.3)] leading-none">✕</div>
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-elimination drop-shadow-[0_0_15px_hsl(var(--elimination)/0.5)]">
            ELIMINATED
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <span className="font-bold text-foreground">{room.chooserName}</span> has made their decision.
            You were cut after Round{" "}
            <span className="font-bold text-foreground">{ROUND_LABELS[currentRound] ?? currentRound}</span>.
          </p>
          <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest">
            Shake it off — the spotlight awaits
          </p>

          <div className="pt-2 space-y-3">
            {poolUrl && (
              <Button
                onClick={() => setLocation(poolUrl)}
                className="w-full h-12 font-display font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
              >
                ↩ REJOIN POOL
              </Button>
            )}
            <Link href="/">
              <Button variant="outline" className="w-full h-11 font-display font-bold uppercase tracking-widest border-border hover:border-primary/50 hover:text-primary">
                {poolUrl ? "Start Fresh" : "Play Again"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col items-center justify-center p-3 sm:p-4 stage-bg">
      {/* Stage lights */}
      <div className="stage-light-1 pointer-events-none" />
      <div className="stage-light-2 pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl h-[calc(100dvh-1.5rem)] sm:h-[84dvh] border border-primary/30 rounded-2xl flex flex-col bg-card/80 backdrop-blur shadow-[0_0_40px_hsl(var(--primary)/0.15)] overflow-hidden">
        {/* Header */}
        <header className="p-3 sm:p-4 border-b border-border bg-primary/8 flex justify-between items-center shrink-0">
          <div>
            <h1 className="font-display text-base sm:text-xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
              {room.chooserName}'s Show
            </h1>
            {myParticipant && (
              <div className="text-xs font-mono text-muted-foreground">
                YOU: <span className="text-primary font-bold">{myParticipant.name.toUpperCase()}</span>
                {myParticipant.suitorSlot != null && (
                  <span className="ml-2 opacity-50">· SEAT {myParticipant.suitorSlot}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isActive && (
              <div className="text-center border-r border-border pr-3">
                <div className="text-[9px] uppercase text-muted-foreground font-mono">Round</div>
                <div className={`font-display font-black text-2xl leading-none ${
                  currentRound === 4 ? "text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.5)]" : "text-primary"
                }`}>
                  {ROUND_LABELS[currentRound] ?? currentRound}
                </div>
              </div>
            )}
            <div className="text-right">
              <div className="text-[9px] uppercase text-muted-foreground font-mono">Status</div>
              <div className={`font-display font-black uppercase text-sm ${
                isActive
                  ? "text-secondary animate-pulse drop-shadow-[0_0_6px_hsl(var(--secondary)/0.5)]"
                  : "text-muted-foreground"
              }`}>
                {isActive ? "🔴 LIVE" : "WAITING"}
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${
              isConnected
                ? "bg-secondary shadow-[0_0_6px_hsl(var(--secondary))] animate-pulse"
                : "bg-muted-foreground"
            }`} />
          </div>
        </header>

        {/* Round strip */}
        {isActive && (
          <div className="px-4 py-2 bg-primary/5 border-b border-border/40 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={10} className="text-primary" />
              {currentRound < (room.maxSuitors - 1)
                ? `${room.maxSuitors + 1 - currentRound} suitors active · 1 question this round`
                : "FINALS · 3 questions · Give it everything"}
            </span>
          </div>
        )}

        {/* Body */}
        <main className="flex-1 overflow-hidden relative">
          {!isActive ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-border border-t-primary animate-spin mb-6" />
              <h2 className="font-display text-2xl font-black uppercase tracking-widest mb-2">
                Backstage
              </h2>
              <p className="text-muted-foreground font-mono text-sm">{room.suitorCount} / {room.maxSuitors} suitors ready</p>
              <p className="text-xs text-muted-foreground/60 font-mono mt-2">Show starts when all seats fill</p>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1 p-3 sm:p-5">
                <div className="flex flex-col gap-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground font-mono text-xs">
                      ⏳ WAITING FOR {room.chooserName?.toUpperCase()}'S QUESTION...
                    </div>
                  )}
                  {messages.map((msg) => {
                    const isMine = msg.senderId === participantId;
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[78%] sm:max-w-[70%] rounded-xl p-3 sm:p-3.5 text-sm ${
                          isMine
                            ? "bg-primary/15 border border-primary/40 self-end"
                            : "bg-card border border-border self-start"
                        }`}
                      >
                        <div className={`text-[10px] font-mono mb-1 ${isMine ? "text-primary/70" : "text-muted-foreground"}`}>
                          {isMine ? "YOU" : room.chooserName}
                        </div>
                        {msg.content}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-3 sm:p-4 border-t border-border shrink-0 bg-background/60 backdrop-blur">
                <form onSubmit={handleSend} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Your answer..."
                    className="h-11 sm:h-12 bg-input border-border focus-visible:ring-primary text-sm sm:text-base"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 sm:h-12 px-4 sm:px-6 font-display font-black bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-[0_0_15px_hsl(var(--primary)/0.3)] gap-1.5"
                  >
                    <Send size={16} /> SEND
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
