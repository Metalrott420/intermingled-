import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGetRoom, useGetRoomMessages, useChooseWinner,
  getGetRoomQueryKey, getGetRoomMessagesQueryKey,
} from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, ChevronRight, Sparkles, Scissors, Flag, Trophy, Zap } from "lucide-react";

type Phase = "messaging" | "eliminate" | "advancing" | "choose_winner";

const ROUND_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "FINAL" };

// ── Report Modal ─────────────────────────────────────────────────────────────
function ReportModal({ targetName, onClose, onSubmit }: {
  targetName: string; onClose: () => void; onSubmit: (reason: string) => void;
}) {
  const REASONS = ["Fake profile", "Inappropriate content", "Harassment", "Spam", "Underage", "Other"];
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit(reason);
    setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="text-4xl">✓</div>
            <h3 className="font-display font-black uppercase tracking-wide">Reported</h3>
            <p className="text-sm text-muted-foreground">{targetName} has been reported.</p>
            <button onClick={onClose} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black uppercase tracking-wide">Report {targetName}</h3>
              <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={`text-xs py-2 px-3 rounded-lg border text-left font-mono transition-all ${
                    reason === r ? "border-destructive bg-destructive/15 text-destructive" : "border-border/60 text-muted-foreground hover:border-border"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
            <button onClick={handleSubmit} disabled={!reason}
              className="w-full py-2.5 bg-destructive text-destructive-foreground rounded-xl font-bold uppercase tracking-widest text-sm disabled:opacity-50">
              Submit Report
            </button>
          </>
        )}
      </div>
    </div>
  );
}

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
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const messageEndRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { getToken } = useAuth();

  const { data: room, isLoading: isLoadingRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) },
  });
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) },
  });

  const [socketToken, setSocketToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setSocketToken(t)).catch(() => {});
  }, [getToken]);

  const chooseWinner = useChooseWinner();
  const chooserName = room?.chooserName ?? undefined;
  const { sendMessage, subscribe } = useSocket(roomId, participantId || undefined, chooserName, "chooser", socketToken ?? undefined);

  const currentRound = room?.currentRound ?? 1;
  const eliminatedParticipants = (room?.eliminatedParticipants ?? []) as string[];
  const finalRound = (room?.maxSuitors ?? 3) - 1;
  const questionsPerRound = currentRound < finalRound ? 1 : 3;
  const suitorSlots = Array.from({ length: room?.maxSuitors ?? 3 }, (_, i) => i + 1);

  const isEliminated = useCallback((suitorId: string) =>
    eliminatedParticipants.includes(suitorId), [eliminatedParticipants]);

  const activeSlots = suitorSlots.filter((slot) => {
    const suitor = room?.participants.find((p) => p.suitorSlot === slot);
    return suitor && !isEliminated(suitor.id);
  });

  const questionsAskedInRound = useCallback((slot: number) =>
    messages.filter((m) => m.senderRole === "chooser" && m.suitorSlot === slot && m.round === currentRound).length,
    [messages, currentRound]);

  const allQuestionsAsked =
    activeSlots.length > 0 &&
    activeSlots.every((slot) => questionsAskedInRound(slot) >= questionsPerRound);

  useEffect(() => {
    if (!allQuestionsAsked || phase !== "messaging") return;
    setPhase(currentRound < finalRound ? "eliminate" : "choose_winner");
  }, [allQuestionsAsked, currentRound, phase]);

  useEffect(() => { setPhase("messaging"); }, [currentRound]);

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
            setUnread((prev) => ({ ...prev, [msg.suitorSlot as number]: (prev[msg.suitorSlot as number] ?? 0) + 1 }));
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
      const t = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (t) headers["Authorization"] = `Bearer ${t}`;
      await fetch(`/api/rooms/${roomId}/eliminate`, {
        method: "POST", headers,
        body: JSON.stringify({ participantId: pId }),
      });
      setPhase("advancing");
    } finally { setIsProcessing(false); }
  };

  const handleAdvanceRound = async () => {
    setIsProcessing(true);
    try {
      const t = await getToken();
      const headers: Record<string, string> = {};
      if (t) headers["Authorization"] = `Bearer ${t}`;
      await fetch(`/api/rooms/${roomId}/advance-round`, { method: "POST", headers });
    } finally { setIsProcessing(false); }
  };

  const handleChoose = (winnerId: string) => {
    chooseWinner.mutate({ id: roomId, data: { winnerId } });
  };

  const handleReport = async (reason: string) => {
    if (!reportTarget) return;
    fetch(`/api/users/${reportTarget.id}/report`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => {});
  };

  const isActive = room?.status === "active";
  const isEnded = room?.status === "ended";

  if (isEnded) { setLocation(`/result/${roomId}`); return null; }
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

  const activeSuitorCount = suitorSlots.filter((slot) => {
    const s = room.participants.find((p) => p.suitorSlot === slot);
    return s && !isEliminated(s.id);
  }).length;

  // ── Slot panel ────────────────────────────────────────────────────────────
  const SlotPanel = ({ slot }: { slot: number }) => {
    const suitor = room.participants.find((p) => p.suitorSlot === slot);
    const slotMessages = messages.filter((m) => m.suitorSlot === slot);
    const eliminated = suitor ? isEliminated(suitor.id) : false;
    const askedThisRound = questionsAskedInRound(slot);
    const quotaMet = askedThisRound >= questionsPerRound;
    const canSend = !eliminated && !quotaMet && phase === "messaging";

    if (!suitor) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center border border-border/20 rounded-xl bg-card/20">
          <span className="text-muted-foreground/40 font-mono text-xs uppercase">EMPTY SEAT</span>
        </div>
      );
    }

    return (
      <div className={`flex-1 flex flex-col border rounded-xl relative overflow-hidden transition-all ${
        eliminated
          ? "border-border/15 bg-card/5 opacity-30"
          : phase === "eliminate"
            ? "border-elimination/50 bg-card/60 shadow-[0_0_20px_hsl(var(--elimination)/0.2)]"
            : phase === "choose_winner"
              ? "border-secondary/60 bg-card/60 shadow-[0_0_20px_hsl(var(--secondary)/0.25)]"
              : "border-primary/25 bg-card/50 hover:border-primary/50 hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]"
      }`}>
        {/* Header */}
        <div className={`p-2 sm:p-3 border-b flex justify-between items-center shrink-0 ${
          eliminated
            ? "border-border/15 bg-muted/5"
            : phase === "choose_winner"
              ? "border-secondary/30 bg-secondary/10"
              : "border-primary/20 bg-primary/8"
        }`}>
          <div className="flex items-center gap-1.5 min-w-0">
            {eliminated && <X size={10} className="text-elimination shrink-0" />}
            <span className={`font-display font-black uppercase truncate text-sm tracking-wide ${
              eliminated ? "text-muted-foreground/40 line-through" : "text-foreground"
            }`}>
              {suitor.name}
            </span>
            {suitor.isBot && !eliminated && (
              <span className="text-[8px] font-mono px-1 py-0.5 rounded border border-violet-500/40 bg-violet-500/10 text-violet-400 shrink-0 uppercase tracking-wider">
                AI
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!eliminated && (
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                quotaMet
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "text-muted-foreground border-border/30"
              }`}>
                {askedThisRound}/{questionsPerRound}
              </span>
            )}
            {!eliminated && (
              <button
                onClick={() => setReportTarget({ id: suitor.id, name: suitor.name })}
                className="text-muted-foreground/40 hover:text-elimination transition-colors"
                title="Report"
              >
                <Flag size={10} />
              </button>
            )}
            {eliminated && <span className="text-[9px] font-mono text-elimination/60">OUT</span>}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-2 sm:p-3">
          <div className="flex flex-col gap-2">
            {slotMessages.map((msg) => {
              const isMine = msg.senderRole === "chooser";
              return (
                <div key={msg.id} className={`max-w-[90%] rounded-lg p-2 text-xs sm:text-sm ${
                  isMine
                    ? "bg-primary/20 border border-primary/40 self-end"
                    : "bg-card border border-border self-start"
                }`}>
                  {msg.content}
                </div>
              );
            })}
            <div ref={(el) => { messageEndRefs.current[slot] = el; }} />
          </div>
        </ScrollArea>

        {/* Input / action area */}
        {!eliminated && (
          <div className="shrink-0 border-t border-border/60">
            {phase === "messaging" && (
              <div className="p-2 sm:p-2.5 bg-background/40">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(slot); }} className="flex gap-1.5">
                  <Input
                    value={inputValues[slot] || ""}
                    onChange={(e) => setInputValues((prev) => ({ ...prev, [slot]: e.target.value }))}
                    placeholder={canSend ? `Ask ${suitor.name}...` : "✓ Asked"}
                    disabled={!canSend}
                    className="h-8 text-xs bg-input border-border focus-visible:ring-primary disabled:opacity-40"
                  />
                  <Button type="submit" size="sm" disabled={!canSend}
                    className="h-8 px-2 bg-primary text-primary-foreground hover:bg-primary/80 text-xs disabled:opacity-30">
                    ASK
                  </Button>
                </form>
              </div>
            )}
            {phase === "eliminate" && (
              <div className="p-2 bg-elimination/5">
                <Button onClick={() => handleEliminate(suitor.id)} disabled={isProcessing} variant="destructive"
                  className="w-full h-9 font-display font-black uppercase tracking-widest text-xs gap-1 border border-elimination/50 bg-elimination hover:bg-elimination/80 shadow-[0_0_12px_hsl(var(--elimination)/0.3)]">
                  <Scissors size={11} /> CUT {suitor.name.toUpperCase()}
                </Button>
              </div>
            )}
            {phase === "advancing" && (
              <div className="p-2">
                <div className="h-9 flex items-center justify-center text-xs font-mono text-muted-foreground">
                  ROUND ENDING...
                </div>
              </div>
            )}
            {phase === "choose_winner" && (
              <div className="p-2 bg-secondary/5">
                <Button onClick={() => handleChoose(suitor.id)} disabled={chooseWinner.isPending}
                  className="w-full h-9 font-display font-black uppercase tracking-widest text-xs gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_0_16px_hsl(var(--secondary)/0.4)]">
                  <Trophy size={11} /> CHOOSE {suitor.name.toUpperCase()}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col stage-bg">
      {/* Report modal */}
      {reportTarget && (
        <ReportModal
          targetName={reportTarget.name}
          onClose={() => setReportTarget(null)}
          onSubmit={handleReport}
        />
      )}

      {/* ── Header ── */}
      <header className="p-3 sm:p-4 border-b border-border bg-background/80 backdrop-blur flex justify-between items-center shrink-0 z-20">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">
            INTERMINGLED
          </h1>
          <div className="text-[10px] font-mono text-muted-foreground">
            ROOM <span className="text-primary">{room.code}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          {isActive && (
            <div className="text-center border-r border-border pr-3 sm:pr-5">
              <div className="text-[9px] uppercase text-muted-foreground font-mono">Round</div>
              <div className={`font-display font-black text-2xl leading-none ${
                currentRound === 4
                  ? "text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary)/0.5)]"
                  : "text-primary"
              }`}>
                {ROUND_LABELS[currentRound] ?? currentRound}
              </div>
            </div>
          )}
          <div className="text-center border-r border-border pr-3 sm:pr-5">
            <div className="text-[9px] uppercase text-muted-foreground font-mono">Active</div>
            <div className="font-display font-bold text-lg leading-none">{isActive ? activeSuitorCount : room.suitorCount}/{room.maxSuitors}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] uppercase text-muted-foreground font-mono">Status</div>
            <div className={`font-display font-black uppercase text-sm ${
              isActive
                ? "text-secondary animate-pulse drop-shadow-[0_0_6px_hsl(var(--secondary)/0.4)]"
                : "text-muted-foreground"
            }`}>
              {isActive ? "🔴 LIVE" : "WAITING"}
            </div>
          </div>
        </div>
      </header>

      {/* ── Phase banners ── */}
      {isActive && phase === "eliminate" && (
        <div className="px-4 py-3 bg-elimination/12 border-b border-elimination/40 flex items-center gap-2 shrink-0">
          <Scissors size={14} className="text-elimination shrink-0 animate-pulse" />
          <span className="text-elimination text-xs font-display font-black uppercase tracking-widest">
            ELIMINATION ROUND — Cut one suitor to advance
          </span>
        </div>
      )}
      {isActive && phase === "advancing" && (
        <div className="px-4 py-2.5 bg-primary/12 border-b border-primary/40 flex items-center justify-between gap-4 shrink-0">
          <span className="text-primary text-xs font-display font-black uppercase tracking-widest">
            SUITOR ELIMINATED — Ready for Round {ROUND_LABELS[currentRound + 1] ?? currentRound + 1}?
          </span>
          <Button size="sm" onClick={handleAdvanceRound} disabled={isProcessing}
            className="h-8 px-4 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/80 font-display font-black uppercase tracking-widest text-xs shrink-0">
            START ROUND {ROUND_LABELS[currentRound + 1] ?? currentRound + 1}
            <ChevronRight size={12} />
          </Button>
        </div>
      )}
      {isActive && phase === "choose_winner" && (
        <div className="px-4 py-3 bg-secondary/12 border-b border-secondary/40 flex items-center gap-2 shrink-0">
          <Sparkles size={14} className="text-secondary shrink-0 animate-pulse" />
          <span className="text-secondary text-xs font-display font-black uppercase tracking-widest">
            FINAL CHOICE — Who do you choose?
          </span>
        </div>
      )}
      {isActive && phase === "messaging" && (
        <div className="px-4 py-1.5 bg-card/20 border-b border-border/30 flex items-center gap-4 shrink-0 overflow-x-auto">
          <span className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider shrink-0 flex items-center gap-1.5">
            <Zap size={10} className="text-primary" />
            {currentRound <= 3 ? `Ask 1 question per suitor — then eliminate` : `Ask 3 questions — then choose your match`}
          </span>
          <div className="flex gap-1.5 ml-auto shrink-0">
            {activeSlots.map((slot) => {
              const asked = questionsAskedInRound(slot);
              const done = asked >= questionsPerRound;
              const suitor = room.participants.find((p) => p.suitorSlot === slot);
              return (
                <div key={slot} className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  done ? "border-primary/40 text-primary bg-primary/10" : "border-border/30 text-muted-foreground"
                }`}>
                  <span>{suitor?.name.slice(0, 4) ?? `#${slot}`}</span>
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
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="font-display text-3xl sm:text-5xl font-black uppercase text-muted-foreground mb-8 tracking-widest">
              Waiting for Contestants
            </div>
            <div className="flex gap-2 sm:gap-4">
              {Array.from({ length: room.maxSuitors }).map((_, i) => (
                <div key={i}
                  className={`w-12 h-16 sm:w-16 sm:h-20 rounded-xl border-2 flex flex-col items-center justify-end pb-2 transition-all ${
                    i < room.suitorCount
                      ? "border-primary/60 bg-primary/15 shadow-[0_0_20px_hsl(var(--primary)/0.25)]"
                      : "border-border/30 bg-card/20"
                  }`}>
                  {i < room.suitorCount ? (
                    <span className="text-primary text-base">★</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs font-mono">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm font-mono text-muted-foreground">{room.suitorCount}/{room.maxSuitors} suitors joined</p>
          </div>
        ) : (
          <>
            {/* MOBILE: tab bar */}
            <div className="sm:hidden flex border-b border-border shrink-0 bg-card/30 overflow-x-auto">
              {suitorSlots.map((slot) => {
                const suitor = room.participants.find((p) => p.suitorSlot === slot);
                if (!suitor) return null;
                const eliminated = isEliminated(suitor.id);
                const count = unread[slot] ?? 0;
                const asked = questionsAskedInRound(slot);
                const done = asked >= questionsPerRound;
                return (
                  <button key={slot} onClick={() => handleTabChange(slot)}
                    className={`flex-1 min-w-[60px] py-2.5 px-1 text-xs font-display font-black uppercase relative transition-colors ${
                      eliminated
                        ? "text-muted-foreground/30 opacity-40"
                        : activeTab === slot
                          ? "text-primary border-b-2 border-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {eliminated ? <span className="line-through">{suitor.name.slice(0, 5)}</span> : suitor.name.slice(0, 6)}
                    {!eliminated && done && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />}
                    {!eliminated && !done && count > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-secondary text-secondary-foreground text-[9px] flex items-center justify-center font-black">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* MOBILE: single panel */}
            <div className="sm:hidden flex-1 flex flex-col overflow-hidden p-2">
              <SlotPanel slot={activeTab} />
            </div>

            {/* DESKTOP: grid */}
            <div className="hidden sm:grid flex-1 grid-cols-3 gap-2 p-3 overflow-hidden">
              {suitorSlots.map((slot) => <SlotPanel key={slot} slot={slot} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
