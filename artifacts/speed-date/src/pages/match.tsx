import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useMatchRoom, MatchResult } from "@workspace/api-client-react";
import { useChooserSocket } from "@/hooks/useSocket";

interface FilledSlot {
  slot: number;
  suitorName: string;
}

export default function Match() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const userId = params.get("userId") || "";
  const name = params.get("name") || "";

  const [matching, setMatching] = useState(false);
  const [filledSlots, setFilledSlots] = useState<FilledSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notEnoughCount, setNotEnoughCount] = useState<number | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const chooserParticipantIdRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const matchRoom = useMatchRoom();
  const { isConnected, subscribe } = useChooserSocket(userId || undefined);

  // Real-time slot filling from server events
  useEffect(() => {
    const unsub = subscribe("slot_filled", ({ slot, suitorName }) => {
      setFilledSlots((prev) => {
        if (prev.some((s) => s.slot === slot)) return prev;
        const next = [...prev, { slot, suitorName }];
        if (
          next.length >= 5 &&
          roomIdRef.current &&
          chooserParticipantIdRef.current &&
          !redirectedRef.current
        ) {
          redirectedRef.current = true;
          sessionStorage.setItem(`participantId_${roomIdRef.current}`, chooserParticipantIdRef.current);
          setTimeout(() => setLocation(`/room/${roomIdRef.current}/chooser`), 700);
        }
        return next;
      });
    });
    return unsub;
  }, [subscribe, setLocation]);

  const handleFindMatches = () => {
    if (!userId) return;
    setError(null);
    setNotEnoughCount(null);
    setFilledSlots([]);
    redirectedRef.current = false;
    setMatching(true);

    matchRoom.mutate(
      { data: { chooserUserId: userId } },
      {
        onSuccess: (data: MatchResult) => {
          roomIdRef.current = data.id;
          chooserParticipantIdRef.current = data.chooserParticipantId;

          // Fallback: if slot_filled events were missed (socket connected after server emitted),
          // drive the animation from the HTTP response participants list after a brief delay.
          setTimeout(() => {
            if (redirectedRef.current) return;
            const suitors: FilledSlot[] = data.participants
              .filter((p) => p.role === "suitor" && p.suitorSlot != null)
              .map((p) => ({ slot: p.suitorSlot as number, suitorName: p.name }))
              .sort((a, b) => a.slot - b.slot);

            if (suitors.length > 0) {
              setFilledSlots(suitors);
              if (suitors.length >= 5 && !redirectedRef.current) {
                redirectedRef.current = true;
                sessionStorage.setItem(`participantId_${data.id}`, data.chooserParticipantId);
                setTimeout(() => setLocation(`/room/${data.id}/chooser`), 700);
              }
            }
          }, 600); // short wait to let any in-flight socket events land first
        },
        onError: (err: any) => {
          setMatching(false);
          if (err?.status === 409) {
            const body = err?.data as { count?: number } | null;
            setNotEnoughCount(body?.count ?? 0);
          } else {
            setError("Something went wrong. Please try again.");
          }
        },
      }
    );
  };

  if (matching) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background">
        <div className="text-center max-w-sm w-full">
          <h1 className="text-3xl font-black uppercase tracking-wider text-primary mb-2">Matching...</h1>
          <p className="text-muted-foreground font-mono text-sm mb-8">
            {filledSlots.length === 0
              ? "Ranking your perfect matches..."
              : `Connecting your suitors (${filledSlots.length} / 5)...`}
          </p>

          <div className="flex justify-center gap-3 mb-8">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = filledSlots.find((s) => s.slot === i + 1);
              return (
                <div
                  key={i}
                  className={`w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center transition-all duration-300 ${
                    filled
                      ? "border-secondary bg-secondary/20 shadow-[0_0_15px_hsl(var(--secondary)/0.4)] scale-110"
                      : "border-border bg-card"
                  }`}
                >
                  {filled ? (
                    <span className="text-secondary text-lg">💘</span>
                  ) : (
                    <span className="text-muted-foreground text-xs font-mono">{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {filledSlots.length > 0 && (
            <div className="space-y-1 mb-4">
              {[...filledSlots]
                .sort((a, b) => a.slot - b.slot)
                .map((s) => (
                  <div key={s.slot} className="text-xs font-mono text-secondary">
                    ✓ Slot {s.slot}: {s.suitorName}
                  </div>
                ))}
            </div>
          )}

          <div className="text-xs font-mono text-muted-foreground animate-pulse">
            {filledSlots.length >= 5
              ? "ALL MATCHED — ENTERING ROOM..."
              : "WAITING FOR CONFIRMATIONS..."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 text-center max-w-md w-full">
        <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          FlirtFest
        </h1>
        {name && (
          <p className="text-muted-foreground font-mono text-sm mb-8">
            Ready to choose, <span className="text-primary font-bold">{name}</span>?
          </p>
        )}

        <div className="bg-card/80 backdrop-blur border border-primary/20 rounded-xl p-8 shadow-[0_0_30px_hsl(var(--primary)/0.15)] space-y-6">
          <div className="text-5xl mb-2">🎯</div>
          <h2 className="text-xl font-bold uppercase tracking-wider">Find Your 5 Matches</h2>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed">
            We'll rank all live suitors by personality compatibility and instantly connect you with your top 5.
          </p>

          {!isConnected && userId && (
            <div className="text-xs font-mono text-muted-foreground animate-pulse text-center">
              Connecting to match server...
            </div>
          )}

          {notEnoughCount !== null && (
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm font-mono">
              <div className="font-bold mb-1">NOT ENOUGH SUITORS YET</div>
              <div>
                {notEnoughCount} live suitor{notEnoughCount !== 1 ? "s" : ""} in pool — need 5 to start.
              </div>
              <div className="mt-2 text-xs opacity-70">Check back soon as more players join!</div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm font-mono">
              {error}
            </div>
          )}

          <button
            onClick={handleFindMatches}
            disabled={matchRoom.isPending || !userId || !isConnected}
            className="w-full h-16 rounded-lg border-2 border-primary bg-primary/10 text-primary font-bold uppercase tracking-widest text-xl hover:bg-primary/20 hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {matchRoom.isPending ? (
              <span className="animate-pulse">MATCHING...</span>
            ) : !isConnected ? (
              "CONNECTING..."
            ) : notEnoughCount !== null ? (
              "TRY AGAIN"
            ) : (
              "FIND MY MATCHES"
            )}
          </button>
        </div>

        <button
          onClick={() => setLocation("/")}
          className="mt-6 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
        >
          ← BACK
        </button>
      </div>
    </div>
  );
}
