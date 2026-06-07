import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { usePoolSocket } from "@/hooks/useSocket";

export default function Pool() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const userId = params.get("userId") || "";
  const name = params.get("name") || "";

  const { isConnected, subscribe } = usePoolSocket(userId || undefined);

  useEffect(() => {
    if (!userId) {
      setLocation("/");
      return;
    }
  }, [userId, setLocation]);

  useEffect(() => {
    const unsub = subscribe("match_found", ({ roomId, participantId }) => {
      sessionStorage.setItem(`participantId_${roomId}`, participantId);
      setLocation(`/room/${roomId}/suitor`);
    });
    return unsub;
  }, [subscribe, setLocation]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 text-center max-w-sm w-full">
        <div className="relative mb-10 mx-auto w-32 h-32">
          <div className="absolute inset-0 rounded-full border-4 border-secondary/20 animate-ping" />
          <div className="absolute inset-2 rounded-full border-4 border-secondary/40 animate-ping [animation-delay:0.3s]" />
          <div className="absolute inset-4 rounded-full border-4 border-secondary/60 animate-ping [animation-delay:0.6s]" />
          <div className="absolute inset-6 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl">💘</span>
          </div>
        </div>

        <h1 className="text-3xl font-black uppercase tracking-wider text-secondary mb-2">
          In the Pool
        </h1>
        <p className="text-muted-foreground font-mono text-sm mb-1">
          Searching for your match...
        </p>
        {name && (
          <p className="text-xs font-mono text-muted-foreground/60">
            AS <span className="text-secondary">{name.toUpperCase()}</span>
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-secondary animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs font-mono text-muted-foreground">
            {isConnected ? "CONNECTED — WAITING FOR CHOOSER" : "CONNECTING..."}
          </span>
        </div>

        <div className="mt-12 text-left border border-border p-5 bg-card/50 backdrop-blur rounded-lg text-sm text-muted-foreground font-mono space-y-2">
          <div className="text-primary font-bold mb-2">WHILE YOU WAIT</div>
          <div>• A chooser will be auto-matched to you</div>
          <div>• You'll be redirected instantly when matched</div>
          <div>• Keep this tab open!</div>
        </div>

        <button
          onClick={() => setLocation("/")}
          className="mt-6 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
        >
          ← LEAVE POOL
        </button>
      </div>
    </div>
  );
}
