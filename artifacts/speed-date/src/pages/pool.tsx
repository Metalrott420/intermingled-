import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@clerk/react";
import { usePoolSocket } from "@/hooks/useSocket";
import { Zap, Star, Heart, ChevronRight, X } from "lucide-react";

interface BrowseProfile {
  id: string;
  name: string;
  bio: string | null;
  photos: string[];
}

export default function Pool() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const userId = params.get("userId") || "";
  const name = params.get("name") || "";

  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setToken(t)).catch(() => {});
  }, [getToken]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([]);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const { isConnected, poolCount, leavePool, subscribe } = usePoolSocket(userId || undefined, token ?? undefined);

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId, setLocation]);

  useEffect(() => {
    const unsub = subscribe("match_found", ({ roomId, participantId }: { roomId: string; participantId: string }) => {
      sessionStorage.setItem(`participantId_${roomId}`, participantId);
      setLocation(`/room/${roomId}/suitor`);
    });
    return unsub;
  }, [subscribe, setLocation]);

  useEffect(() => {
    fetch("/api/users/looking")
      .then((r) => r.json())
      .then((data) => {
        const profiles = (data.users ?? []).filter((u: BrowseProfile) => u.id !== userId);
        setBrowseProfiles(profiles);
      })
      .catch(() => {});
  }, [userId]);

  const handleLike = useCallback(async (profileId: string) => {
    setLiked((prev) => new Set([...prev, profileId]));
    fetch(`/api/users/${profileId}/like`, { method: "POST", credentials: "include" }).catch(() => {});
    setBrowseIndex((i) => Math.min(i + 1, browseProfiles.length - 1));
  }, [browseProfiles.length]);

  const handlePass = useCallback(() => {
    setBrowseIndex((i) => Math.min(i + 1, browseProfiles.length - 1));
  }, [browseProfiles.length]);

  const handleLeave = () => {
    leavePool();
    setLocation("/");
  };

  const enoughPlayers = poolCount !== null && poolCount >= 5;
  const currentProfile = browseProfiles[browseIndex];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground spotlight-bg overflow-hidden">
      {/* Stage lights */}
      <div className="stage-light-1 pointer-events-none" />
      <div className="stage-light-2 pointer-events-none" />

      {/* Ticker bar */}
      <div className="relative z-20 bg-secondary/90 text-secondary-foreground py-1.5 overflow-hidden">
        <div className="flex items-center gap-2 ticker-scroll whitespace-nowrap text-xs font-display font-bold uppercase tracking-widest">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="flex items-center gap-4">
              <span>⭐ INTERMINGLED LIVE</span>
              <span className="opacity-50">·</span>
              <span>REAL-TIME SPEED DATING</span>
              <span className="opacity-50">·</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* ── LEFT: Waiting status ── */}
        <div className="lg:w-80 flex flex-col items-center justify-center p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-border/40">
          {/* Animated radar */}
          <div className="relative mb-6 mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/35 animate-ping [animation-delay:0.3s]" />
            <div className="absolute inset-4 rounded-full border-2 border-primary/50 animate-ping [animation-delay:0.6s]" />
            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap size={20} className="text-primary" />
            </div>
          </div>

          <h1 className="font-display text-2xl font-black uppercase tracking-widest text-primary mb-1 text-center drop-shadow-[0_0_10px_hsl(var(--primary)/0.6)]">
            BACKSTAGE
          </h1>
          {name && (
            <p className="text-xs font-mono text-muted-foreground/60 mb-5 text-center">
              COMPETING AS <span className="text-secondary font-bold">{name.toUpperCase()}</span>
            </p>
          )}

          {/* Live pool count */}
          <div className="w-full mb-5 px-4 py-4 rounded-xl border border-primary/30 bg-primary/5 text-center">
            {poolCount === null ? (
              <div className="text-xs font-mono text-muted-foreground animate-pulse">CONNECTING...</div>
            ) : (
              <>
                <div className="font-display text-5xl font-black text-primary tabular-nums drop-shadow-[0_0_20px_hsl(var(--primary)/0.5)]">
                  {poolCount}
                </div>
                <div className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-widest">
                  SUITOR{poolCount !== 1 ? "S" : ""} WAITING
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                  NEED 5 TO GO LIVE
                </div>
                {enoughPlayers && (
                  <div className="mt-2 text-xs font-mono text-secondary animate-pulse font-bold">
                    🔥 ENOUGH PLAYERS — MATCH INCOMING...
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slot dots */}
          <div className="flex justify-center gap-2 mb-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${
                  poolCount !== null && i < poolCount
                    ? "bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                    : "bg-border"
                }`}
              />
            ))}
          </div>

          {/* Connection status */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-secondary animate-pulse shadow-[0_0_6px_hsl(var(--secondary))]" : "bg-muted-foreground"}`} />
            <span className="text-xs font-mono text-muted-foreground">
              {isConnected ? "LIVE — WAITING FOR CHOOSER" : "CONNECTING..."}
            </span>
          </div>

          {/* Tips */}
          <div className="w-full border border-border/40 p-3 bg-card/40 backdrop-blur rounded-xl text-xs text-muted-foreground space-y-1.5 mb-5">
            <div className="text-primary font-bold text-[10px] uppercase tracking-widest mb-1.5">WHILE YOU WAIT</div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">▸</span>
              <span>Your personality is being matched with a chooser</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">▸</span>
              <span>You'll be redirected the instant you match</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">▸</span>
              <span>Browse other suitors below to kill time</span>
            </div>
          </div>

          {/* Leave */}
          {showConfirm ? (
            <div className="w-full border border-destructive/40 bg-destructive/10 rounded-xl p-4 space-y-3">
              <p className="text-sm font-mono text-destructive text-center">Leave the pool? You'll lose your spot.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleLeave}
                  className="flex-1 py-2 rounded-lg border border-destructive text-destructive text-sm font-bold font-mono hover:bg-destructive hover:text-white transition-colors"
                >
                  LEAVE
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm font-mono hover:border-primary hover:text-primary transition-colors"
                >
                  STAY
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-xs text-muted-foreground/60 font-mono hover:text-destructive transition-colors"
            >
              ← Leave pool
            </button>
          )}
        </div>

        {/* ── RIGHT: Browse-while-waiting ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
          <div className="w-full max-w-sm">
            <div className="text-center mb-4">
              <h2 className="font-display text-xl font-black uppercase tracking-widest text-foreground/80">
                WHO'S IN THE ARENA
              </h2>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {browseProfiles.length > 0
                  ? `${browseProfiles.length} suitor${browseProfiles.length !== 1 ? "s" : ""} competing today`
                  : "Loading suitors..."}
              </p>
            </div>

            {currentProfile ? (
              <div className="gameshow-card overflow-hidden">
                {/* Photo */}
                <div className="relative aspect-[4/5] bg-gradient-to-br from-primary/20 to-secondary/10">
                  {currentProfile.photos?.[0] ? (
                    <img
                      src={`/api/storage${currentProfile.photos[0]}`}
                      alt={currentProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-display text-7xl font-black text-primary/30">
                        {currentProfile.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="font-display text-2xl font-black uppercase text-white drop-shadow-lg">
                      {currentProfile.name}
                    </h3>
                    {currentProfile.bio && (
                      <p className="text-sm text-white/80 line-clamp-2 mt-1">{currentProfile.bio}</p>
                    )}
                  </div>
                  {/* Card counter */}
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur rounded-full px-2.5 py-1 text-[10px] font-mono text-white/80">
                    {browseIndex + 1}/{browseProfiles.length}
                  </div>
                  {liked.has(currentProfile.id) && (
                    <div className="absolute top-3 left-3 bg-secondary/90 text-secondary-foreground rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide">
                      ★ LIKED
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="p-4 flex gap-3">
                  <button
                    onClick={handlePass}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border/60 text-muted-foreground hover:border-destructive/50 hover:text-destructive transition-all font-bold uppercase text-sm font-display"
                  >
                    <X size={16} /> PASS
                  </button>
                  <button
                    onClick={() => handleLike(currentProfile.id)}
                    disabled={liked.has(currentProfile.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-all font-bold uppercase text-sm font-display shadow-[0_0_20px_hsl(var(--secondary)/0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Star size={16} /> LIKE
                  </button>
                </div>
              </div>
            ) : browseProfiles.length === 0 ? (
              <div className="gameshow-card p-10 text-center space-y-3">
                <Heart size={40} className="mx-auto text-primary/30" />
                <p className="text-muted-foreground text-sm font-mono">
                  {browseProfiles.length === 0 ? "Loading profiles..." : "You've seen everyone for now!"}
                </p>
              </div>
            ) : (
              <div className="gameshow-card p-10 text-center space-y-3">
                <Star size={40} className="mx-auto text-secondary/50" />
                <p className="font-display font-bold uppercase tracking-wide text-lg">ALL CAUGHT UP!</p>
                <p className="text-muted-foreground text-sm font-mono">You've browsed all the suitors.</p>
                <button
                  onClick={() => setBrowseIndex(0)}
                  className="mt-2 flex items-center gap-1.5 mx-auto text-xs font-mono text-primary hover:underline"
                >
                  Start over <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
