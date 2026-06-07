import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { usePoolSocket } from "@/hooks/useSocket";

export default function Pool() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const userId = params.get("userId") || "";
  const name = params.get("name") || "";

  const [showConfirm, setShowConfirm] = useState(false);
  const { isConnected, poolCount, leavePool, subscribe } = usePoolSocket(userId || undefined);

  useEffect(() => {
    if (!userId) {
      setLocation("/");
    }
  }, [userId, setLocation]);

  useEffect(() => {
    const unsub = subscribe("match_found", ({ roomId, participantId }) => {
      sessionStorage.setItem(`participantId_${roomId}`, participantId);
      setLocation(`/room/${roomId}/suitor`);
    });
    return unsub;
  }, [subscribe, setLocation]);

  const handleLeave = () => {
    leavePool();
    setLocation("/");
  };

  const enoughPlayers = poolCount !== null && poolCount >= 5;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 text-center max-w-sm w-full">
        {/* Animated radar */}
        <div className="relative mb-8 mx-auto w-28 h-28 sm:w-32 sm:h-32">
          <div className="absolute inset-0 rounded-full border-4 border-secondary/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border-4 border-secondary/40 animate-ping [animation-delay:0.3s]" />
          <div className="absolute inset-4 rounded-full border-4 border-secondary/60 animate-ping [animation-delay:0.6s]" />
          <div className="absolute inset-6 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-secondary mb-1">
          In the Pool
        </h1>
        {name && (
          <p className="text-xs font-mono text-muted-foreground/60 mb-4">
            AS <span className="text-secondary">{name.toUpperCase()}</span>
          </p>
        )}

        {/* Live pool count */}
        <div className="mb-6 px-4 py-3 rounded-lg border border-secondary/30 bg-secondary/5">
          {poolCount === null ? (
            <div className="text-xs font-mono text-muted-foreground animate-pulse">CONNECTING TO POOL...</div>
          ) : (
            <>
              <div className="text-3xl font-black text-secondary tabular-nums">{poolCount}</div>
              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                SUITOR{poolCount !== 1 ? "S" : ""} WAITING &middot; NEED 5 TO START
              </div>
              {enoughPlayers && (
                <div className="mt-2 text-xs font-mono text-primary animate-pulse font-bold">
                  ENOUGH PLAYERS — MATCH INCOMING...
                </div>
              )}
            </>
          )}
        </div>

        {/* Pool dots */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${
                poolCount !== null && i < poolCount
                  ? "bg-secondary shadow-[0_0_8px_hsl(var(--secondary))]"
                  : "bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-secondary animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs font-mono text-muted-foreground">
            {isConnected ? "CONNECTED — WAITING FOR CHOOSER" : "CONNECTING..."}
          </span>
        </div>

        <div className="text-left border border-border p-4 bg-card/50 backdrop-blur rounded-lg text-sm text-muted-foreground font-mono space-y-1.5 mb-6">
          <div className="text-primary font-bold mb-2 text-xs uppercase tracking-wider">While you wait</div>
          <div className="text-xs">A chooser is ranked against your personality</div>
          <div className="text-xs">You'll be redirected the moment you match</div>
          <div className="text-xs">Keep this tab open</div>
        </div>

        {/* Leave confirmation */}
        {showConfirm ? (
          <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 space-y-3">
            <p className="text-sm font-mono text-destructive">Leave the pool? You'll lose your spot.</p>
            <div className="flex gap-2">
              <button
                onClick={handleLeave}
                className="flex-1 py-2 rounded border border-destructive text-destructive text-sm font-bold font-mono hover:bg-destructive hover:text-white transition-colors"
              >
                LEAVE
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded border border-border text-muted-foreground text-sm font-mono hover:border-secondary hover:text-secondary transition-colors"
              >
                STAY
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-xs text-muted-foreground font-mono hover:text-destructive transition-colors"
          >
            ← Leave pool
          </button>
        )}
      </div>
    </div>
  );
}
