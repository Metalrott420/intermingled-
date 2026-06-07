import { useEffect, useState, useRef, useCallback } from "react";
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
import { X, ChevronRight, Sparkles, Scissors } from "lucide-react";

type Phase = "messaging" | "eliminate" | "advancing" | "choose_winner";

const ROUND_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "FINAL" };

export default function RoomChooser() {
  const params = useParams();
  const roomId = params.id as string;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState(1);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [phase, setPhase] = useState<Phase>("messaging");
  const [isProcessing, setIsProcessing] = useState(false);
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

  // ── Derived state ────────────────────────────────────────────────────────────
  const currentRound = room?.currentRound ?? 1;
  const eliminatedParticipants = (room?.eliminatedParticipants ?? []) as string[];
  const questionsPerRound = currentRound <= 3 ? 1 : 3;
  const suitorSlots = [1, 2, 3, 4, 5];

  const isEliminated = useCallback((suitorId: string) =>
    eliminatedParticipants.includes(suitorId), [eliminatedParticipants]);

  const activeSlots = suitorSlots.filter((slot) => {
    const suitor = room?.participants.find((p) => p.suitorSlot === slot);
    return suitor && !isEliminated(suitor.id);
  });

  const questionsAskedInRound = useCallback((slot: number) =>
    messages.filter(
      (m) => m.senderRole === "chooser" && m.suitorSlot === slot && m.round === currentRound,
    ).length, [messages, currentRound]);

  const allQuestionsAsked =
    activeSlots.length > 0 &&
    activeSlots.every((slot) => questionsAskedInRound(slot) >= questionsPerRound);

  // ── Phase transitions ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!allQuestionsAsked || phase !== "messaging") return;
    setPhase(currentRound < 4 ? "eliminate" : "choose_winner");
  }, [allQuestionsAsked, currentRound, phase]);

  useEffect(() => {
    setPhase("messaging");
  }, [currentRound]);

  // ── Socket events ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!participantId) setLocation("/");
  }, [participantId, setLocation]);

  useEffect(() => {
    const unsubMsg = subscribe("message_received", (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (msg.senderRole === "suitor" && msg.suitorSlot != null) {
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

  useEffect(() => {
    messageEndRefs.current[activeTab]?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleTabChange = (slot: number) => {
    setActiveTab(slot);
    setUnread((prev) => ({ ...prev, [slot]: 0 }));
  };

  const handleSend = (slot: number) => {
    const content = inputValues[slot];
    if (!content?.trim() || phase !== "messaging") return;
    if (questionsAskedInRound(slot) >= questionsPerRound) return;
    sendMessage(content, slot, currentRound);
    setInputValues((prev) => ({ ...prev, [slot]: "" }));
  };

  const handleEliminate = async (pId: string) => {
    setIsProcessing(true);
    try {
      await fetch(`/api/rooms/${roomId}/eliminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: pId }),
      });
      setPhase("advancing");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvanceRound = async () => {
    setIsProcessing(true);
    try {
      await fetch(`/api/rooms/${roomId}/advance-round`, { method: "POST" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChoose = (winnerId: string) => {
    chooseWinner.mutate({ id: roomId, data: { winnerId } });
  };

  // ── Loading / ended ──────────────────────────────────────────────────────────
  const isActive = room?.status === "active";
  const isEnded = room?.status === "ended";

  if (isEnded) { setLocation(`/result/${roomId}`); return null; }
  if (isLoadingRoom || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">
        LOADING DATABANKS...
      </div>
    );
  }

  const activeSuitorCount = suitorSlots.filter((slot) => {
    const s = room.participants.find((p) => p.suitorSlot === slot);
    return s && !isEliminated(s.id);
  }).length;

  // ── Slot panel component ─────────────────────────────────────────────────────
  const SlotPanel = ({ slot }: { slot: number }) => {
    const suitor = room.participants.find((p) => p.suitorSlot === slot);
    const slotMessages = messages.filter((m) => m.suitorSlot === slot);
    const eliminated = suitor ? isEliminated(suitor.id) : false;
    const askedThisRound = questionsAskedInRound(slot);
    const quotaMet = askedThisRound >= questionsPerRound;
    const canSend = !eliminated && !quotaMet && phase === "messaging";

    if (!suitor) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center border border-border/30 rounded bg-card/20">
          <span className="text-muted-foreground font-mono text-xs">NO CONNECTION</span>
        </div>
      );
    }

    return (
      <div className={`flex-1 flex flex-col border rounded relative overflow-hidden transition-all ${
        eliminated
          ? "border-border/20 bg-card/10 opacity-40"
          : phase === "eliminate"
            ? "border-destructive/40 bg-card/50 shadow-[0_0_12px_hsl(var(--destructive)/0.15)]"
            : phase === "choose_winner"
              ? "border-primary/40 bg-card/50 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
              : "border-secondary/30 bg-card/50 shadow-[0_0_10px_hsl(var(--secondary)/0.1)] hover:border-secondary hover:shadow-[0_0_20px_hsl(var(--secondary)/0.3)]"
      }`}>
        {/* Header */}
        <div className={`p-2 sm:p-3 border-b flex justify-between items-center shrink-0 ${
          eliminated ? "border-border/20 bg-muted/10" : "border-secondary/30 bg-secondary/10"
        }`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {eliminated && <X size={10} className="text-destructive shrink-0" />}
            <span className={`font-bold uppercase truncate text-sm ${eliminated ? "text-muted-foreground line-through" : "text-secondary"}`}>
              {suitor.name}
            </span>
          </div>
          {!eliminated && (
            <span className={`text-[10px] font-mono shrink-0 ml-1 px-1.5 py-0.5 rounded ${
              quotaMet
                ? "bg-secondary/20 text-secondary border border-secondary/30"
                : "text-muted-foreground border border-border/30"
            }`}>
              {askedThisRound}/{questionsPerRound}
            </span>
          )}
          {eliminated && (
            <span className="text-[9px] font-mono text-destructive/70 shrink-0">OUT</span>
          )}
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

        {/* ── Input / action area ── */}
        {!eliminated && (
          <div className="shrink-0 border-t border-border">
            {/* Messaging phase: input box */}
            {phase === "messaging" && (
              <div className="p-2 sm:p-3 bg-background/50">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(slot); }}
                  className="flex gap-1.5 sm:gap-2"
                >
                  <Input
                    value={inputValues[slot] || ""}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, [slot]: e.target.value }))}
                    placeholder={canSend ? `Ask ${suitor.name}...` : "Question asked ✓"}
                    disabled={!canSend}
                    className="h-8 text-xs sm:text-sm bg-input border-border focus-visible:ring-secondary disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSend}
                    className="h-8 px-2 sm:px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs disabled:opacity-40"
                  >
                    ASK
                  </Button>
                </form>
              </div>
            )}

            {/* Eliminate phase: big red button */}
            {phase === "eliminate" && (
              <div className="p-2 sm:p-3 bg-destructive/5">
                <Button
                  onClick={() => handleEliminate(suitor.id)}
                  disabled={isProcessing}
                  variant="destructive"
                  className="w-full h-9 font-bold uppercase tracking-widest text-xs gap-1.5 border border-destructive/50"
                >
                  <Scissors size={12} />
                  ELIMINATE {suitor.name.toUpperCase()}
                </Button>
              </div>
            )}

            {/* Advancing phase: read-only */}
            {phase === "advancing" && (
              <div className="p-2 sm:p-3">
                <div className="h-9 flex items-center justify-center text-xs font-mono text-muted-foreground">
                  ROUND ENDING...
                </div>
              </div>
            )}

            {/* Choose winner phase: glory button */}
            {phase === "choose_winner" && (
              <div className="p-2 sm:p-3 bg-primary/5">
                <Button
                  onClick={() => handleChoose(suitor.id)}
                  disabled={chooseWinner.isPending}
                  className="w-full h-9 font-bold uppercase tracking-widest text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                >
                  <Sparkles size={12} />
                  CHOOSE {suitor.name.toUpperCase()}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="p-3 sm:p-4 border-b border-border bg-card/50 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg sm:text-2xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_8px_hsl(var(--primary))]">
            Intermingled
          </h1>
          <div className="text-xs font-mono text-muted-foreground">
            ROOM: <span className="text-secondary">{room.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Round indicator */}
          {isActive && (
            <div className="text-center border-r border-border pr-3 sm:pr-6">
              <div className="text-xs uppercase text-muted-foreground font-mono">Round</div>
              <div className={`font-black font-mono text-xl leading-none ${
                currentRound === 4 ? "text-primary" : "text-secondary"
              }`}>
                {ROUND_LABELS[currentRound] ?? currentRound}
              </div>
            </div>
          )}
          <div className="text-center border-r border-border pr-3 sm:pr-6">
            <div className="text-xs uppercase text-muted-foreground font-mono">Active</div>
            <div className="font-bold font-mono">{isActive ? activeSuitorCount : room.suitorCount} / 5</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase text-muted-foreground font-mono">Status</div>
            <div className={`font-bold uppercase text-sm ${isActive ? "text-secondary animate-pulse" : "text-primary"}`}>
              {isActive ? "LIVE" : "WAITING"}
            </div>
          </div>
        </div>
      </header>

      {/* ── Phase banner ── */}
      {isActive && phase === "eliminate" && (
        <div className="px-4 py-2.5 bg-destructive/15 border-b border-destructive/40 flex items-center gap-2 shrink-0">
          <Scissors size={14} className="text-destructive shrink-0" />
          <span className="text-destructive text-xs font-bold uppercase tracking-widest">
            ELIMINATE A SUITOR — Choose who goes home
          </span>
        </div>
      )}
      {isActive && phase === "advancing" && (
        <div className="px-4 py-2 bg-orange-500/15 border-b border-orange-500/40 flex items-center justify-between gap-4 shrink-0">
          <span className="text-orange-400 text-xs font-bold uppercase tracking-widest">
            SUITOR ELIMINATED — Ready for Round {ROUND_LABELS[currentRound + 1] ?? currentRound + 1}?
          </span>
          <Button
            size="sm"
            onClick={handleAdvanceRound}
            disabled={isProcessing}
            className="h-8 px-4 gap-1.5 bg-orange-500 text-white hover:bg-orange-400 font-bold uppercase tracking-widest text-xs shrink-0"
          >
            START ROUND {ROUND_LABELS[currentRound + 1] ?? currentRound + 1}
            <ChevronRight size={12} />
          </Button>
        </div>
      )}
      {isActive && phase === "choose_winner" && (
        <div className="px-4 py-2.5 bg-primary/15 border-b border-primary/40 flex items-center gap-2 shrink-0">
          <Sparkles size={14} className="text-primary shrink-0" />
          <span className="text-primary text-xs font-bold uppercase tracking-widest">
            CHOOSE YOUR MATCH — The final 2 have answered all your questions
          </span>
        </div>
      )}
      {isActive && phase === "messaging" && (
        <div className="px-4 py-1.5 bg-card/30 border-b border-border/40 flex items-center gap-4 shrink-0 overflow-x-auto">
          <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider shrink-0">
            {currentRound <= 3 ? `Ask 1 question per suitor — then eliminate` : `Ask 3 questions — then choose your match`}
          </span>
          <div className="flex gap-2 ml-auto shrink-0">
            {activeSlots.map((slot) => {
              const asked = questionsAskedInRound(slot);
              const done = asked >= questionsPerRound;
              const suitor = room.participants.find((p) => p.suitorSlot === slot);
              return (
                <div key={slot} className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                  done ? "border-secondary/50 text-secondary bg-secondary/10" : "border-border/40 text-muted-foreground"
                }`}>
                  <span>{suitor?.name.slice(0, 5) ?? `#${slot}`}</span>
                  <span>{done ? "✓" : `${asked}/${questionsPerRound}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
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
                    {i < room.suitorCount ? "✓" : String(i + 1)}
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
                if (!suitor) return null;
                const eliminated = isEliminated(suitor.id);
                const count = unread[slot] ?? 0;
                const asked = questionsAskedInRound(slot);
                const done = asked >= questionsPerRound;
                return (
                  <button
                    key={slot}
                    onClick={() => handleTabChange(slot)}
                    className={`flex-1 min-w-[60px] py-2.5 px-1 text-xs font-bold uppercase font-mono relative transition-colors ${
                      eliminated
                        ? "text-muted-foreground/40 opacity-50"
                        : activeTab === slot
                          ? "text-secondary border-b-2 border-secondary bg-secondary/10"
                          : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {eliminated ? <span className="line-through">{suitor.name.slice(0, 5)}</span> : suitor.name.slice(0, 6)}
                    {!eliminated && done && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-secondary" />
                    )}
                    {!eliminated && !done && count > 0 && (
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

            {/* ── DESKTOP: grid ── */}
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
