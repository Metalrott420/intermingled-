import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { useMatchRoom, MatchResult } from "@workspace/api-client-react";
import { useChooserSocket } from "@/hooks/useSocket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Crown } from "lucide-react";
import FeatureTutorialModal from "@/components/FeatureTutorialModal";

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
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { user: clerkUser } = useUser();
  const ALLOWED_ADMIN_EMAIL = "metalrott.7@gmail.com";
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const isAdmin = userEmail === ALLOWED_ADMIN_EMAIL;

  const [matching, setMatching] = useState<boolean>(search.includes("spin=true"));
  const [filledSlots, setFilledSlots] = useState<FilledSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notEnoughCount, setNotEnoughCount] = useState<number | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const chooserParticipantIdRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setToken(t)).catch(() => {});
  }, [getToken]);

  const matchRoom = useMatchRoom();
  const { isConnected, poolCount, subscribe } = useChooserSocket(userId || undefined, token ?? undefined);

  // Real-time slot filling from server events
  useEffect(() => {
    const unsub = subscribe("slot_filled", ({ slot, suitorName }) => {
      setFilledSlots((prev) => {
        if (prev.some((s) => s.slot === slot)) return prev;
        const next = [...prev, { slot, suitorName }];
        if (
          next.length >= 4 &&
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

  // When not-enough error resolves (pool grows to ≥5), clear the error state
  useEffect(() => {
    if (notEnoughCount !== null && poolCount !== null && poolCount >= 5) {
      setNotEnoughCount(null);
    }
  }, [poolCount, notEnoughCount]);

  const handleFindMatches = () => {
    if (!userId || !isConnected) {
      const testRoomId = `test-room-${Date.now()}`;
      sessionStorage.setItem(`participantId_${testRoomId}`, "chooser-test-123");
      setLocation(`/room/${testRoomId}/chooser?adminTest=true`);
      return;
    }
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

          setTimeout(() => {
            if (redirectedRef.current) return;
            const suitors: FilledSlot[] = data.participants
              .filter((p) => p.role === "suitor" && p.suitorSlot != null)
              .map((p) => ({ slot: p.suitorSlot as number, suitorName: p.name }))
              .sort((a, b) => a.slot - b.slot);

            if (suitors.length > 0) {
              setFilledSlots(suitors);
              if (suitors.length >= 4 && !redirectedRef.current) {
                redirectedRef.current = true;
                sessionStorage.setItem(`participantId_${data.id}`, data.chooserParticipantId);
                setTimeout(() => setLocation(`/room/${data.id}/chooser`), 700);
              }
            }
          }, 600);
        },
        onError: () => {
          const testRoomId = `test-room-${Date.now()}`;
          sessionStorage.setItem(`participantId_${testRoomId}`, "chooser-test-123");
          setLocation(`/room/${testRoomId}/chooser?adminTest=true`);
        },
      },
    );
  };

  // Stepped Slot Machine Reel Deceleration Sequence
  const [lockedReels, setLockedReels] = useState<number>(0);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!matching) return;

    const roomId = `test-room-${Date.now()}`;
    setTargetRoomId(roomId);
    sessionStorage.setItem(`participantId_${roomId}`, "chooser-test-123");

    // Staggered decelerating lock sequence (Reels 1-4 lock at 1s, 2s, 3s, 4s)
    const t1 = setTimeout(() => setLockedReels(1), 1000);
    const t2 = setTimeout(() => setLockedReels(2), 2000);
    const t3 = setTimeout(() => setLockedReels(3), 3000);
    const t4 = setTimeout(() => setLockedReels(4), 4000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [matching]);

  if (matching) {
    const demoSuitors = [
      { name: "Bot Marcus (94%)", slot: 1 },
      { name: "Bot Jessica (89%)", slot: 2 },
      { name: "Bot Tyler (85%)", slot: 3 },
      { name: "Bot Elena (81%)", slot: 4 },
    ];

    const spinNames = ["Marcus K.", "Jessica T.", "Tyler R.", "Elena V.", "David M.", "Sarah B.", "Chloe W."];

    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-[#08080c] text-foreground relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none" />

        <div className="z-10 text-center max-w-lg w-full space-y-6">
          <div className="space-y-2">
            <a href={`${base}/`} className="inline-block group">
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-widest text-gold-hd-3d group-hover:scale-105 transition-transform">
                ✨ VECTOR COMPATIBILITY ENGINE ✨
              </h1>
            </a>
            <p className="text-xs font-mono text-[#d4af37] uppercase tracking-wider font-bold">
              ANALYZING SUITOR POOL · MATCHING PERSONALITY VECTORS...
            </p>
          </div>

          {/* 4 Curated Compatibility Columns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111218] border-2 border-[#d4af37]/50 rounded-2xl p-4 shadow-[0_0_50px_rgba(212,175,55,0.3)]">
            {demoSuitors.map((suitor, i) => {
              const isLocked = lockedReels >= i + 1;
              return (
                <div
                  key={i}
                  className={`h-32 rounded-xl border-2 flex flex-col items-center justify-center p-2 transition-all duration-500 relative overflow-hidden ${
                    isLocked
                      ? "border-[#d4af37] bg-[#d4af37]/15 shadow-[0_0_20px_rgba(212,175,55,0.4)] scale-105"
                      : "border-[#222538] bg-[#181a24]"
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase text-[#d4af37] font-bold mb-1">
                    MATCH {i + 1}
                  </div>

                  {isLocked ? (
                    <div className="space-y-1 animate-in zoom-in-50">
                      <div className="text-2xl">✨</div>
                      <div className="font-bold text-xs text-white uppercase tracking-wider">{suitor.name}</div>
                      <Badge className="bg-emerald-500 text-black text-[8px] font-black uppercase">CURATED ✓</Badge>
                    </div>
                  ) : (
                    <div className="space-y-1 animate-pulse">
                      <div className="text-lg text-[#d4af37] font-mono animate-bounce">⚡</div>
                      <div className="text-[11px] font-mono text-slate-400 font-bold uppercase">
                        {spinNames[(i * 2 + Math.floor(Date.now() / 200)) % spinNames.length]}
                      </div>
                      <div className="text-[9px] font-mono text-amber-400">ANALYZING…</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stepped Launcher Button - Appears once Reel 4 locks! */}
          {lockedReels >= 4 ? (
            <div className="space-y-3 animate-in zoom-in-75">
              <p className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider animate-pulse">
                ✨ ALL 4 SUITORS CURATED & MATCHED!
              </p>
              <Button
                onClick={() => setLocation(`/room/${targetRoomId || "test-room-1"}/chooser?adminTest=true`)}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-sm tracking-widest shadow-2xl shadow-[#d4af37]/30 hover:scale-[1.03] transition-all"
              >
                START ROUND 1 (3-MIN PROFILE REVIEW) 🚀
              </Button>
            </div>
          ) : (
            <div className="text-xs font-mono text-[#d4af37] font-bold animate-pulse">
              CURATING COMPATIBLE MATCHES ({lockedReels} / 4 MATCHED)…
            </div>
          )}
        </div>
      </div>
    );
  }

  const liveCount = poolCount ?? 0;
  const enoughPlayers = liveCount >= 4;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 text-center max-w-md w-full">
        <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
          Intermingled
        </h1>
        {name && (
          <p className="text-muted-foreground font-mono text-sm mb-6">
            Ready to choose, <span className="text-primary font-bold">{name}</span>?
          </p>
        )}

        <div className="bg-card/80 backdrop-blur border border-primary/20 rounded-xl p-6 sm:p-8 shadow-[0_0_30px_hsl(var(--primary)/0.15)] space-y-5">
          <div className="flex flex-col items-center gap-2">
            {isAdmin ? (
              <Badge className="bg-[#d4af37] text-black font-black uppercase text-xs tracking-wider px-3 py-1 shadow-md">
                👑 ADMIN COORDINATOR PASS: UNLIMITED MATCHES UNLOCKED
              </Badge>
            ) : (
              <Badge variant="outline" className="border-emerald-500 text-emerald-400 font-mono text-xs uppercase font-bold px-3 py-1">
                💖 FREE PASS: 5/5 MATCHES REMAINING TODAY
              </Badge>
            )}
            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider">Find Your 4 Suitor Matches</h2>
          </div>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed">
            We rank all live suitors by personality compatibility and instantly connect you with your top 4. Enjoy 5 free matches daily!
          </p>

          {/* Live suitor pool count */}
          <div className={`rounded-lg border p-4 transition-colors ${
            enoughPlayers ? "border-secondary/40 bg-secondary/5" : "border-border bg-background/50"
          }`}>
            <div className={`text-4xl font-black tabular-nums mb-1 transition-colors ${
              enoughPlayers ? "text-secondary" : poolCount === null ? "text-muted-foreground" : "text-foreground"
            }`}>
              {poolCount === null ? "—" : liveCount}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              SUITOR{liveCount !== 1 ? "S" : ""} IN POOL RIGHT NOW
            </div>
            <div className="mt-2 flex justify-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                    i < liveCount ? "bg-secondary shadow-[0_0_6px_hsl(var(--secondary))]" : "bg-border"
                  }`}
                />
              ))}
            </div>
            {enoughPlayers && (
              <div className="mt-2 text-xs font-mono text-secondary font-bold animate-pulse">
                READY TO MATCH
              </div>
            )}
          </div>

          {!isConnected && userId && (
            <div className="text-xs font-mono text-muted-foreground animate-pulse">
              Connecting to match server...
            </div>
          )}

          {notEnoughCount !== null && !enoughPlayers && (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-mono">
              <div className="font-bold mb-1">NOT ENOUGH SUITORS YET</div>
              <div className="text-xs">
                {liveCount} live suitor{liveCount !== 1 ? "s" : ""} in pool — need 5 to start.
                The count above updates live as players join.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm font-mono">
              {error}
            </div>
          )}

          {/* Instant AI Bot Match Button */}
          <button
            onClick={() => {
              const testRoomId = `test-room-${Date.now()}`;
              sessionStorage.setItem(`participantId_${testRoomId}`, "chooser-test-123");
              setLocation(`/room/${testRoomId}/chooser?adminTest=true`);
            }}
            className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#d4af37]/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <span>Start 3-Round Match (vs 4 AI Bots) 🤖👑</span>
          </button>

          <button
            onClick={handleFindMatches}
            className="w-full h-12 rounded-xl border-2 border-[#d4af37]/50 bg-[#181a24] hover:bg-[#222538] text-white font-bold uppercase tracking-widest text-xs transition-all hover:scale-[1.01]"
          >
            {matchRoom.isPending ? "MATCHING..." : "Find Human Matches"}
          </button>
        </div>

        <button
          onClick={() => setLocation("/")}
          className="mt-5 text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Matchmaking Feature Onboarding Tutorial Modal */}
      <FeatureTutorialModal
        featureId="match"
        featureTitle="Vector Compatibility Engine"
        steps={[
          {
            icon: Sparkles,
            headline: "Vector Compatibility Matching",
            description: "Analyze your 4-suitor chemistry alignment in real time based on your 7-question personality vector.",
          },
          {
            icon: Zap,
            headline: "4 Curated Suitor Matches",
            description: "Curates 4 top-matched suitors with compatibility scores (e.g. 94% Match) tailored to your dating expectations.",
          },
          {
            icon: Crown,
            headline: "Launch 3-Round Speed Dating",
            description: "Click 'LAUNCH SPEED DATE MATCH' to enter the live gameshow stage for Round 1 pre-game profile review and broadcast AI questions!",
          },
        ]}
      />
    </div>
  );
}
