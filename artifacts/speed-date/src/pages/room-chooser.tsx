import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useGetRoom, useGetRoomMessages, useChooseWinner,
  getGetRoomQueryKey, getGetRoomMessagesQueryKey,
} from "@workspace/api-client-react";
import { useSocket } from "@/hooks/useSocket";
import { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Sparkles, Scissors, Flag, Trophy, Zap, Clock } from "lucide-react";
import CountdownTimer from "@/components/CountdownTimer";
import RoundProgress from "@/components/RoundProgress";
import { QuestionRatingPanel } from "@/components/QuestionRatingPanel";
import { useGameCues } from "@/hooks/useGameCues";

type Phase = "profile_review" | "messaging" | "eliminate" | "advancing" | "choose_winner";

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
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const participantId = sessionStorage.getItem(`participantId_${roomId}`);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValues, setInputValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState(1);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [phase, setPhase] = useState<Phase>("profile_review");
  const [reviewRemaining, setReviewRemaining] = useState(180); // 3-Minute Pre-Game Review
  const [isProcessing, setIsProcessing] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingElimination, setPendingElimination] = useState<{ id: string; name: string } | null>(null);
  const messageEndRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eliminationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { getToken } = useAuth();

  const isAdminTest = roomId.startsWith("test-room-") || (typeof window !== "undefined" && window.location.search.includes("adminTest=true"));

  const AI_BOT_PROFILES: Record<number, {
    name: string; photo: string; age: number; location: string; occupation: string; education: string; goal: string; bio: string; likes: string[]; dislikes: string[];
  }> = {
    1: {
      name: "Marcus K.",
      photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      age: 27, location: "Austin, TX", occupation: "Architect & Designer", education: "UT Austin M.Arch",
      goal: "Looking for a meaningful long-term relationship",
      bio: "Passionate about modern architecture, espresso brewing, and weekend mountain bike trails. Always looking for someone who loves spontaneous road trips!",
      likes: ["Coffee Brewing", "Modern Art", "Trail Running", "Live Jazz"],
      dislikes: ["Late Arrivals", "Cold Pizza", "Ghosting"],
    },
    2: {
      name: "Jessica T.",
      photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
      age: 25, location: "Austin, TX", occupation: "Software Engineer & Musician", education: "Stanford BS CS",
      goal: "Marriage-minded & adventurous partnership",
      bio: "Full-stack developer by day, indie synth-pop musician by night. Big fan of vinyl records, outdoor yoga, and cooking authentic Thai curries.",
      likes: ["Vinyl Records", "Thai Food", "Indie Concerts", "Outdoor Yoga"],
      dislikes: ["Bad WiFi", "Negative Energy", "Small Talk"],
    },
    3: {
      name: "Tyler R.",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      age: 28, location: "Austin, TX", occupation: "Creative Director", education: "NYU Tisch BFA",
      goal: "Looking for my partner in crime",
      bio: "Film director, photography enthusiast, and amateur chef. Love deep conversations over craft cocktails and discovering hidden speakeasies.",
      likes: ["Photography", "Craft Beer", "Film Cameras", "Foodie Trips"],
      dislikes: ["Monotony", "Cilantro", "Unpunctuality"],
    },
    4: {
      name: "Elena V.",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
      age: 26, location: "Austin, TX", occupation: "Biomedical Researcher", education: "Johns Hopkins PhD",
      goal: "Building a supportive, inspiring future together",
      bio: "Researching neurobiology, hiking local greenbelts, and baking sourdough bread on Sundays. Looking for genuine connection and shared laughter.",
      likes: ["Sourdough Baking", "Greenbelt Hikes", "Sci-Fi Books", "Dogs"],
      dislikes: ["Arrogance", "Crowded Subways", "Dishonesty"],
    },
  };

  const VECTOR_AI_QUESTIONS: Record<number, string[]> = {
    1: [
      "What is your idea of a perfect, spontaneous weekend getaway?",
      "How do you balance personal space with quality time in a relationship?",
      "What is a hobby or passion you could talk about for hours?",
    ],
    2: [
      "How do you handle disagreements when two people have different opinions?",
      "What is the most meaningful gesture someone has ever done for you?",
      "What does your ideal work-life balance look like 5 years from now?",
    ],
    3: [
      "What is a core value or belief you will never compromise on?",
      "What is your love language and how do you best feel appreciated?",
      "What made you realize you were ready for a serious, committed relationship?",
    ],
  };

  const BOT_UNIQUE_ANSWERS: Record<string, string[]> = {
    "Bot Marcus (94%)": [
      "I love spontaneous camping in the mountains and brewing fresh espresso on Sunday mornings.",
      "Communication is everything to me—calm, honest talk over dinner always resolves disagreements.",
      "Integrity and loyalty. If you don't have trust, you have nothing.",
    ],
    "Bot Jessica (89%)": [
      "A quiet indie music concert followed by cooking authentic Thai curry together.",
      "I give people space to express themselves and listen deeply before responding.",
      "Spontaneity and mutual respect. Life is too short not to encourage each other's dreams.",
    ],
    "Bot Tyler (85%)": [
      "Exploring hidden speakeasies and street photography in a new city.",
      "Humor breaks the tension! A playful perspective helps solve any conflict.",
      "Kindness and curiosity. Someone who stays curious about the world and empathetic.",
    ],
    "Bot Elena (81%)": [
      "Baking fresh sourdough bread and hiking local greenbelt trails with my dog.",
      "Empathy first—I put myself in the other person's shoes before jumping to conclusions.",
      "Authenticity and passion. I value people who are genuinely themselves without pretense.",
    ],
  };

  const [hasBroadcastQuestion, setHasBroadcastQuestion] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(60);

  // Broadcast question to ALL active suitors simultaneously
  const handleBroadcastQuestion = (questionText: string) => {
    setHasBroadcastQuestion(true);
    setQuestionTimer(60);

    activeSlots.forEach((slot) => {
      const suitor = room?.participants.find((p) => p.suitorSlot === slot);
      if (!suitor) return;

      // Broadcast Chooser Question
      const qMsg: Message = {
        id: `q-${slot}-${Date.now()}`,
        roomId,
        userId: "admin-chooser-123",
        userName: chooserName || "Chooser 👑",
        content: `❓ Q: ${questionText}`,
        createdAt: new Date().toISOString(),
        senderRole: "chooser",
        suitorSlot: slot,
        round: currentRound,
      };

      setMessages((prev) => [...prev, qMsg]);

      // Trigger unique AI Bot response in 1.5s
      if (isAdminTest && suitor.name) {
        setTimeout(() => {
          const botAnswers = BOT_UNIQUE_ANSWERS[suitor.name] || [
            "I value genuine connection, mutual respect, and shared laughter above all else!",
          ];
          const chosenAnswer = botAnswers[(currentRound - 1) % botAnswers.length];

          const ansMsg: Message = {
            id: `ans-${slot}-${Date.now()}`,
            roomId,
            userId: suitor.id,
            userName: suitor.name,
            content: `💡 A: ${chosenAnswer}`,
            createdAt: new Date().toISOString(),
            senderRole: "suitor",
            suitorSlot: slot,
            round: currentRound,
          };

          setMessages((prev) => [...prev, ansMsg]);
        }, 1500 + slot * 300);
      }
    });
  };

  const mockTestRoom = useMemo(() => {
    if (!isAdminTest) return null;
    return {
      id: roomId,
      code: "ADMIN-TEST",
      status: "active",
      chooserName: "Admin Chooser 👑",
      currentRound: 1,
      maxSuitors: 4,
      numberOfRounds: 3,
      roomSnapshotVersion: 1,
      participants: [
        { id: "admin-chooser-123", name: "Admin Chooser 👑", role: "chooser", suitorSlot: null },
        { id: "bot-suitor-1", name: "Bot Marcus (94%)", role: "suitor", suitorSlot: 1 },
        { id: "bot-suitor-2", name: "Bot Jessica (89%)", role: "suitor", suitorSlot: 2 },
        { id: "bot-suitor-3", name: "Bot Tyler (85%)", role: "suitor", suitorSlot: 3 },
        { id: "bot-suitor-4", name: "Bot Elena (81%)", role: "suitor", suitorSlot: 4 },
      ],
      eliminatedParticipants: [],
    };
  }, [isAdminTest, roomId]);

  const { data: serverRoom, isLoading: isLoadingRoom } = useGetRoom(roomId, {
    query: { enabled: !!roomId && !isAdminTest, queryKey: getGetRoomQueryKey(roomId) },
  });

  const room = serverRoom || mockTestRoom;
  const { data: initialMessages } = useGetRoomMessages(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId) },
  });

  const [socketToken, setSocketToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setSocketToken(t)).catch(() => {});
  }, [getToken]);

  const chooseWinner = useChooseWinner();
  const { playEliminationStinger } = useGameCues();
  const chooserName = room?.chooserName ?? undefined;
  const { isConnected, sendMessage, subscribe } = useSocket(isAdminTest ? undefined : roomId, participantId || undefined, chooserName, "chooser", socketToken ?? undefined, room?.roomSnapshotVersion);

  const [testEliminatedIds, setTestEliminatedIds] = useState<string[]>([]);
  const [testCurrentRound, setTestCurrentRound] = useState<number>(1);
  const [customQuestionInput, setCustomQuestionInput] = useState<string>("");
  const [inspectedSlotProfile, setInspectedSlotProfile] = useState<number | null>(null);

  const currentRound = isAdminTest ? testCurrentRound : (room?.currentRound ?? 1);
  const eliminatedParticipants = isAdminTest ? testEliminatedIds : ((room?.eliminatedParticipants ?? []) as string[]);
  const finalRound = (room?.maxSuitors ?? 4) - 1;
  const questionsPerRound = 1;
  const suitorSlots = Array.from({ length: 4 }, (_, i) => i + 1);
  const currentRoundQuestions = (room?.currentRoundQuestions ?? []) as Array<{
    id: string;
    content: string;
    packSlug?: string;
    category: string;
    difficulty: string;
    ratingSummary?: {
      questionId: string;
      ratingCount: number;
      averageRating: number | null;
      qualityScore: number | null;
    };
  }>;

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
    if (phase === "profile_review" || phase === "advancing") return;
    if (allQuestionsAsked) {
      setPhase(currentRound < finalRound ? "eliminate" : "choose_winner");
      return;
    }
  }, [allQuestionsAsked, currentRound, finalRound, phase]);

  // 3-Minute Pre-Game Profile Review Countdown Interval
  useEffect(() => {
    if (phase !== "profile_review") return;

    const interval = setInterval(() => {
      setReviewRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase("messaging");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "advancing") return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      void handleAdvanceRound();
    }, 1200);
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (eliminationTimerRef.current) clearTimeout(eliminationTimerRef.current);
    };
  }, []);

  useEffect(() => { if (currentRound > 1) setPhase("messaging"); }, [currentRound]);

  useEffect(() => {
    if (phase !== "advancing") return;
    if (!room?.eliminatedParticipants?.length) return;
    setPendingElimination(null);
  }, [phase, room?.eliminatedParticipants]);

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (!isConnected || !roomId) return;
    queryClient.invalidateQueries({ queryKey: getGetRoomQueryKey(roomId) });
    queryClient.invalidateQueries({ queryKey: getGetRoomMessagesQueryKey(roomId) });
  }, [isConnected, roomId, queryClient]);

  useEffect(() => {
    if (room?.status === "ended") {
      setLocation(`/result/${roomId}`);
    }
  }, [room?.status, roomId, setLocation]);

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
    const unsubTimer = subscribe("timer_sync", ({ endsAt }) => {
      const cached = queryClient.getQueryData(getGetRoomQueryKey(roomId)) as any;
      if (cached) {
        queryClient.setQueryData(getGetRoomQueryKey(roomId), { ...cached, roundEndsAt: endsAt });
      }
    });
    const unsubRoundStart = subscribe("round_started", ({ round, endsAt }) => {
      const cached = queryClient.getQueryData(getGetRoomQueryKey(roomId)) as any;
      if (cached) {
        queryClient.setQueryData(getGetRoomQueryKey(roomId), { ...cached, currentRound: round, roundEndsAt: endsAt });
      }
    });
    const unsubSessionEnded = subscribe("session_ended", () => {
      setLocation(`/result/${roomId}`);
    });
    return () => { unsubMsg(); unsubRoom(); unsubTimer(); unsubRoundStart(); unsubSessionEnded(); };
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
      const target = room?.participants.find((p) => p.id === pId);
      setPendingElimination(target ? { id: target.id, name: target.name } : null);
      playEliminationStinger();
      setPhase("eliminate");
      if (eliminationTimerRef.current) clearTimeout(eliminationTimerRef.current);
      await new Promise((resolve) => {
        eliminationTimerRef.current = setTimeout(resolve, 800);
      });

      if (isAdminTest) {
        setTestEliminatedIds((prev) => [...prev, pId]);
        setTestCurrentRound((prevRound) => {
          const nextRound = prevRound + 1;
          setHasBroadcastQuestion(false); // Reset question broadcast so Round 2 or Round 3 questions display!
          setPhase("messaging");
          return nextRound;
        });
        setPendingElimination(null);
        return;
      }

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

  const [winnerModalData, setWinnerModalData] = useState<{
    id: string;
    name: string;
    photo: string;
    score: string;
    bio: string;
    location: string;
  } | null>(null);

  const { playWinnerFanfare } = useGameCues();

  const handleChoose = (winnerId: string) => {
    const winnerSuitor = room?.participants.find((p) => p.id === winnerId);
    const winnerSlot = winnerSuitor?.suitorSlot || 1;
    const botProfile = AI_BOT_PROFILES[winnerSlot] || AI_BOT_PROFILES[1];

    playWinnerFanfare();

    setWinnerModalData({
      id: winnerId,
      name: winnerSuitor?.name || botProfile.name,
      photo: botProfile.photo,
      score: "94%",
      bio: botProfile.bio,
      location: botProfile.location,
    });
  };

  const handleStartDirectChat = () => {
    if (!winnerModalData) return;

    // Save match to localStorage matches list
    const newMatch = {
      id: `match-${winnerModalData.id}-${Date.now()}`,
      otherName: winnerModalData.name,
      otherPhotos: [winnerModalData.photo],
      otherUserId: winnerModalData.id,
      chooserUserId: "me",
      suitorUserId: winnerModalData.id,
      createdAt: new Date().toISOString(),
    };

    const existingMatchesRaw = localStorage.getItem("intermingled_matches");
    let existingMatches = [];
    try { existingMatches = existingMatchesRaw ? JSON.parse(existingMatchesRaw) : []; } catch {}

    if (!existingMatches.some((m: any) => m.otherName === winnerModalData.name)) {
      existingMatches.unshift(newMatch);
      localStorage.setItem("intermingled_matches", JSON.stringify(existingMatches));
    }

    // Redirect directly into 1-on-1 Governed Chat Window!
    setLocation(`/conversation/${newMatch.id}`);
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
  const endsAt = room?.roundEndsAt ?? null;
  const numberOfRounds = room?.numberOfRounds ?? 3;

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
          <div className="flex items-center gap-2 min-w-0">
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
          <div className="flex items-center gap-2 shrink-0">
            {!eliminated && (
              <button
                onClick={() => setInspectedSlotProfile(slot)}
                className="text-[9px] font-mono px-2 py-0.5 rounded border border-[#d4af37]/40 bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition-colors font-bold uppercase"
              >
                Inspect 📄
              </button>
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

        {phase === "eliminate" && pendingElimination?.id === suitor.id && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-pulse">
            <div className="text-center space-y-2 px-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">Suspense</div>
              <div className="font-display font-black text-3xl uppercase text-elimination drop-shadow-[0_0_18px_hsl(var(--elimination)/0.45)]">
                {suitor.name}
              </div>
            </div>
          </div>
        )}

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
              <div className="p-2 text-center bg-[#181a24]">
                <span className="text-[10px] font-mono text-[#d4af37] font-bold">
                  {hasBroadcastQuestion ? "✓ Question Broadcasted · Awaiting Answers" : "Select Broadcast Question Above ↑"}
                </span>
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
                <div className="h-9 flex items-center justify-center text-xs font-mono text-muted-foreground gap-2 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                  ROUND ENDING...
                </div>
              </div>
            )}
            {phase === "choose_winner" && !suitor.isBot && (
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
        <a href={`${base}/`} className="group block text-left">
          <h1 className="font-display text-xl sm:text-2xl font-black text-primary uppercase tracking-widest drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] group-hover:text-secondary transition-colors">
            INTERMINGLED
          </h1>
          <div className="text-[10px] font-mono text-muted-foreground">
            ROOM <span className="text-primary">{room.code}</span>
          </div>
        </a>
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
          <div className={`w-2 h-2 rounded-full ${
            isConnected
              ? "bg-secondary shadow-[0_0_6px_hsl(var(--secondary))] animate-pulse"
              : "bg-muted-foreground"
          }`} aria-label={isConnected ? "Connected" : "Reconnecting"} />
        </div>
      </header>

      {isActive && currentRoundQuestions.length > 0 && (
        <QuestionRatingPanel
          roomId={roomId}
          participantId={participantId}
          questions={currentRoundQuestions}
          authToken={socketToken}
        />
      )}

      {/* ── Phase banners ── */}
      {isActive && phase === "eliminate" && (
        <div className="px-4 py-3 bg-elimination/12 border-b border-elimination/40 flex items-center gap-2 shrink-0 animate-in fade-in zoom-in-95 duration-300">
          <Scissors size={14} className="text-elimination shrink-0 animate-pulse" />
          <span className="text-elimination text-xs font-display font-black uppercase tracking-widest">
            ELIMINATION ROUND — Cut one suitor to advance
          </span>
        </div>
      )}
      {isActive && phase === "advancing" && (
        <div className="px-4 py-2.5 bg-primary/12 border-b border-primary/40 flex items-center justify-between gap-4 shrink-0 animate-in fade-in slide-in-from-top-1 duration-300">
          <span className="text-primary text-xs font-display font-black uppercase tracking-widest">
            SUITOR ELIMINATED — Advancing to Round {ROUND_LABELS[currentRound + 1] ?? currentRound + 1}
          </span>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            AUTO-ADVANCING
          </div>
        </div>
      )}
      {isActive && phase === "choose_winner" && (
        <div className="px-4 py-3 bg-secondary/12 border-b border-secondary/40 flex items-center gap-2 shrink-0 animate-in fade-in zoom-in-95 duration-300">
          <Sparkles size={14} className="text-secondary shrink-0 animate-pulse" />
          <span className="text-secondary text-xs font-display font-black uppercase tracking-widest">
            FINAL CHOICE — Who do you choose?
          </span>
        </div>
      )}
      {isActive && !isConnected && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2 shrink-0 animate-pulse">
          <span className="text-amber-400 text-xs font-mono uppercase tracking-widest">Reconnecting to live room...</span>
        </div>
      )}
      {isActive && phase === "messaging" && (
        <div className="p-4 bg-[#111218] border-b-2 border-[#d4af37]/40 shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#d4af37] text-black font-black uppercase text-[10px]">
                ROUND {currentRound} AI QUESTION ENGINE
              </Badge>
              <span className="text-xs font-mono text-slate-300 font-bold">
                BROADCAST 1 QUESTION TO ALL ACTIVE SUITORS
              </span>
            </div>
            {hasBroadcastQuestion && (
              <Badge variant="outline" className="border-emerald-500 text-emerald-400 font-mono text-xs animate-pulse">
                60S ANSWER TIMER RUNNING
              </Badge>
            )}
          </div>

          {!hasBroadcastQuestion ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-300 font-sans">
                Select 1 AI question below or type your own custom question to send to all {activeSlots.length} active suitors simultaneously:
              </p>

              {/* 3 AI Vector Questions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(VECTOR_AI_QUESTIONS[currentRound] || VECTOR_AI_QUESTIONS[1]).map((qText, i) => (
                  <button
                    key={i}
                    onClick={() => handleBroadcastQuestion(qText)}
                    className="p-3 rounded-xl border border-[#d4af37]/40 bg-[#181a24] hover:bg-[#222538] hover:border-[#d4af37] text-left text-xs font-sans text-white font-medium transition-all hover:scale-[1.01] flex flex-col justify-between space-y-2 shadow-md"
                  >
                    <span>"{qText}"</span>
                    <span className="text-[10px] font-mono text-[#d4af37] uppercase font-bold text-right block">
                      BROADCAST TO ALL SUITORS →
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Question Input Bar */}
              <div className="pt-2 border-t border-[#d4af37]/20 flex flex-col sm:flex-row gap-2">
                <Input
                  value={customQuestionInput}
                  onChange={(e) => setCustomQuestionInput(e.target.value)}
                  placeholder="Or write your own custom question here..."
                  className="bg-[#181a24] border-[#222538] text-xs font-sans text-white flex-1 h-11 focus:border-[#d4af37]"
                />
                <Button
                  onClick={() => {
                    if (!customQuestionInput.trim()) return;
                    handleBroadcastQuestion(customQuestionInput.trim());
                    setCustomQuestionInput("");
                  }}
                  disabled={!customQuestionInput.trim()}
                  className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-black uppercase text-xs h-11 px-5 disabled:opacity-40"
                >
                  BROADCAST CUSTOM QUESTION 🚀
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-[#181a24] border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold text-xs">✓ QUESTION BROADCASTED TO ALL SUITORS</span>
                <span className="text-xs text-slate-300 font-mono">· Inspect unique answers below & eliminate 1 suitor</span>
              </div>
              <Button
                onClick={() => setPhase(currentRound < 3 ? "eliminate" : "choose_winner")}
                className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-black uppercase text-xs py-1.5 px-3"
              >
                PROCEED TO ELIMINATION ✂️
              </Button>
            </div>
          )}
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
        ) : phase === "profile_review" ? (
          /* Facebook Dating UI Profile Review Cards Phase */
          <div className="flex-1 p-4 overflow-y-auto max-w-4xl mx-auto w-full space-y-4">
            <div className="bg-[#111218] border-2 border-[#d4af37]/50 rounded-2xl p-5 text-center shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
                <div className="flex items-center gap-2 text-left">
                  <Badge className="bg-[#d4af37] text-black font-black uppercase text-[10px]">ROUND 1 PRE-GAME REVIEW</Badge>
                  <span className="text-xs font-mono text-slate-300 font-bold">INSPECT ALL 4 SUITOR PROFILES</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#d4af37] font-extrabold bg-[#d4af37]/10 px-3 py-1 rounded-lg border border-[#d4af37]/30">
                  <Clock size={14} className="animate-pulse" />
                  <span>3-MIN REVIEW: {Math.floor(reviewRemaining / 60)}:{(reviewRemaining % 60).toString().padStart(2, "0")}</span>
                </div>
              </div>

              {/* Suitor Tab Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {suitorSlots.map((slot) => {
                  const profile = AI_BOT_PROFILES[slot];
                  const isActiveTab = activeTab === slot;
                  return (
                    <button
                      key={slot}
                      onClick={() => setActiveTab(slot)}
                      className={`p-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                        isActiveTab ? "border-[#d4af37] bg-[#d4af37]/20 shadow-lg" : "border-[#222538] bg-[#181a24]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-[#d4af37] shrink-0">
                        <img src={profile.photo} alt={profile.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-white truncate">{profile.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{profile.age} · {profile.location}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Facebook Dating Style Profile Card */}
              {AI_BOT_PROFILES[activeTab] && (
                <div className="bg-[#141622] border border-[#d4af37]/30 rounded-2xl p-5 text-left space-y-4 shadow-xl animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-[#d4af37] shadow-xl shrink-0">
                      <img src={AI_BOT_PROFILES[activeTab].photo} alt={AI_BOT_PROFILES[activeTab].name} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{AI_BOT_PROFILES[activeTab].name}, {AI_BOT_PROFILES[activeTab].age}</h3>
                        <Badge variant="outline" className="border-[#d4af37]/40 text-[#d4af37] text-[10px] font-mono">VERIFIED SUITOR</Badge>
                      </div>
                      <p className="text-xs text-slate-300 font-mono">📍 {AI_BOT_PROFILES[activeTab].location} · 💼 {AI_BOT_PROFILES[activeTab].occupation}</p>
                      <p className="text-xs text-slate-300 font-mono">🎓 {AI_BOT_PROFILES[activeTab].education}</p>
                      <p className="text-xs font-bold text-[#d4af37] pt-1">🎯 Goal: {AI_BOT_PROFILES[activeTab].goal}</p>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-[#d4af37]/20 pt-3">
                    <p className="text-[10px] font-mono uppercase text-[#d4af37] font-bold">About Me</p>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">{AI_BOT_PROFILES[activeTab].bio}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-[#d4af37]/20 pt-3 text-xs">
                    <div>
                      <p className="text-[10px] font-mono uppercase text-emerald-400 font-bold mb-1">💚 Likes</p>
                      <div className="flex flex-wrap gap-1">
                        {AI_BOT_PROFILES[activeTab].likes.map((like) => (
                          <Badge key={like} className="bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[10px]">{like}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase text-rose-400 font-bold mb-1">💔 Dislikes</p>
                      <div className="flex flex-wrap gap-1">
                        {AI_BOT_PROFILES[activeTab].dislikes.map((dislike) => (
                          <Badge key={dislike} className="bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[10px]">{dislike}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => setPhase("messaging")}
                className="w-full py-4 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#d4af37]/25"
              >
                BEGIN ROUND 1 QUESTIONS 🚀
              </Button>
            </div>
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

            {/* DESKTOP: grid of ACTIVE SUITORS ONLY (Eliminated cards removed!) */}
            <div className={`hidden sm:grid flex-1 gap-3 p-3 overflow-hidden ${
              activeSlots.length === 4 ? "grid-cols-4" : activeSlots.length === 3 ? "grid-cols-3" : "grid-cols-2 max-w-2xl mx-auto w-full"
            }`}>
              {activeSlots.map((slot) => <SlotPanel key={slot} slot={slot} />)}
            </div>
          </>
        )}
      </main>

      {/* 3D Center-Stage Winner Matching Stinger Modal */}
      {winnerModalData && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-[#d4af37] rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-[0_0_80px_rgba(212,175,55,0.5)] relative overflow-hidden animate-in zoom-in-75 duration-500">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158]" />

            <div className="space-y-2 pt-2">
              <Badge className="bg-[#d4af37] text-black font-black uppercase text-xs tracking-widest px-3 py-1 shadow-lg">
                🎉 IT'S A PERFECT MATCH! 👑
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black text-gold-hd-3d uppercase tracking-widest pt-1">
                {winnerModalData.name}
              </h2>
              <p className="text-xs font-mono text-[#d4af37] font-bold">
                MATCH COMPATIBILITY SCORE: {winnerModalData.score}
              </p>
            </div>

            {/* Winner Center-Stage Photo Card */}
            <div className="relative w-40 h-40 mx-auto rounded-3xl overflow-hidden border-4 border-[#d4af37] shadow-2xl">
              <img src={winnerModalData.photo} alt={winnerModalData.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-2">
                <span className="text-[10px] font-mono text-white font-bold">📍 {winnerModalData.location}</span>
              </div>
            </div>

            <p className="text-xs text-slate-200 font-sans leading-relaxed px-2">
              Congratulations! You and <span className="font-bold text-[#d4af37]">{winnerModalData.name}</span> completed all 3 rounds of speed dating and matched!
            </p>

            <Button
              onClick={handleStartDirectChat}
              className="w-full py-4 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-xs tracking-wider shadow-xl shadow-[#d4af37]/30 hover:scale-[1.03] transition-all"
            >
              ADD TO MATCHES & START 1-ON-1 CHAT 💖
            </Button>
          </div>
        </div>
      )}

      {/* Inspected Suitor Profile Modal */}
      {inspectedSlotProfile !== null && AI_BOT_PROFILES[inspectedSlotProfile] && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-[#d4af37] rounded-3xl max-w-md w-full p-6 text-left space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#d4af37] text-black font-black uppercase text-[10px]">VERIFIED SUITOR PROFILE</Badge>
              </div>
              <button onClick={() => setInspectedSlotProfile(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#d4af37] shadow-xl shrink-0">
                <img src={AI_BOT_PROFILES[inspectedSlotProfile].photo} alt={AI_BOT_PROFILES[inspectedSlotProfile].name} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-lg font-black text-white">{AI_BOT_PROFILES[inspectedSlotProfile].name}, {AI_BOT_PROFILES[inspectedSlotProfile].age}</h3>
                <p className="text-xs text-slate-300 font-mono">📍 {AI_BOT_PROFILES[inspectedSlotProfile].location}</p>
                <p className="text-xs text-slate-300 font-mono">💼 {AI_BOT_PROFILES[inspectedSlotProfile].occupation}</p>
                <p className="text-xs text-slate-300 font-mono">🎓 {AI_BOT_PROFILES[inspectedSlotProfile].education}</p>
                <p className="text-xs font-bold text-[#d4af37] pt-1">🎯 {AI_BOT_PROFILES[inspectedSlotProfile].goal}</p>
              </div>
            </div>

            <div className="space-y-1 border-t border-[#d4af37]/20 pt-3">
              <p className="text-[10px] font-mono uppercase text-[#d4af37] font-bold">About Me</p>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{AI_BOT_PROFILES[inspectedSlotProfile].bio}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-[#d4af37]/20 pt-3 text-xs">
              <div>
                <p className="text-[10px] font-mono uppercase text-emerald-400 font-bold mb-1">💚 Likes</p>
                <div className="flex flex-wrap gap-1">
                  {AI_BOT_PROFILES[inspectedSlotProfile].likes.map((like) => (
                    <Badge key={like} className="bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[9px]">{like}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase text-rose-400 font-bold mb-1">💔 Dislikes</p>
                <div className="flex flex-wrap gap-1">
                  {AI_BOT_PROFILES[inspectedSlotProfile].dislikes.map((dislike) => (
                    <Badge key={dislike} className="bg-rose-950/60 border border-rose-800/40 text-rose-300 text-[9px]">{dislike}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={() => setInspectedSlotProfile(null)}
              className="w-full py-3 bg-[#181a24] hover:bg-[#222538] text-white font-bold uppercase text-xs border border-[#d4af37]/40 mt-2"
            >
              Close Profile Inspection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
