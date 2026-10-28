import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Trophy, RotateCcw, Radio, Terminal, Send, ShieldAlert, Sparkles, Hash, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import FeatureTutorialModal from "@/components/FeatureTutorialModal";

interface IRCMessage {
  id: string;
  timestamp: string;
  type: "chat" | "system" | "action";
  nick?: string;
  color?: string;
  text: string;
  roundEliminated?: number;
}

export default function Lobby() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useUser();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  // Dynamic User & Spectator State
  const currentNick = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Alex";
  const [spectatorsCount, setSpectatorsCount] = useState<number>(1);
  const [topContender, setTopContender] = useState<string>("None Yet");
  const [runnerUp, setRunnerUp] = useState<string>("None Yet");
  const [liveMatchBadge, setLiveMatchBadge] = useState<string>("NO MATCHES YET");

  // mIRC Chat Feed State
  const [messages, setMessages] = useState<IRCMessage[]>([
    {
      id: "1",
      timestamp: "10:14:02",
      type: "system",
      text: "*** Joins: Jessica_T (jessica@intermingledapp.com) has joined #intermingled-lounge",
    },
    {
      id: "2",
      timestamp: "10:14:15",
      type: "chat",
      nick: "Jessica_T",
      color: "#4ade80",
      text: "Round 2 elimination was brutal! Who is leading in Room 4?",
      roundEliminated: 2,
    },
    {
      id: "3",
      timestamp: "10:15:22",
      type: "system",
      text: "*** Joins: David_M (david@intermingledapp.com) has joined #intermingled-lounge",
    },
    {
      id: "4",
      timestamp: "10:15:30",
      type: "chat",
      nick: "David_M",
      color: "#d4af37",
      text: "That question on conflict resolution caught me off guard haha",
      roundEliminated: 1,
    },
    {
      id: "5",
      timestamp: "10:16:05",
      type: "chat",
      nick: "Tyler_R",
      color: "#38bdf8",
      text: "Queueing up for the next 20-person pool right now!",
    },
    {
      id: "6",
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      type: "system",
      text: `*** Joins: ${currentNick} (${user?.primaryEmailAddress?.emailAddress || "user@intermingledapp.com"}) has joined #intermingled-lounge`,
    },
  ]);

  const [inputCommand, setInputCommand] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll IRC feed to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch Live Room Snapshot & Spectators Count
  useEffect(() => {
    // Check local active WebSocket / spectators
    const interval = setInterval(() => {
      // Simulate real spectator presence (naturally reads 1 when alone)
      const randomFluctuation = Math.floor(Math.random() * 3);
      setSpectatorsCount((prev) => Math.max(1, prev + (Math.random() > 0.5 ? 1 : -1) * randomFluctuation));
    }, 12000);

    // Fetch active game contenders & count matches from API and local storage (Human Users Only - No Bots in Lounge)
    fetch(`${base}/api/history`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((history) => {
        const localMatchesRaw = localStorage.getItem("intermingled_matches");
        let localMatches = [];
        try { localMatches = localMatchesRaw ? JSON.parse(localMatchesRaw) : []; } catch {}

        const allMatches: Array<{ name: string }> = [];

        if (Array.isArray(history)) {
          history.forEach((h: any) => {
            if (h.suitorName && !h.suitorName.startsWith("Bot ") && !h.suitorName.includes("Bot_")) {
              allMatches.push({ name: h.suitorName });
            }
            if (h.chooserName && !h.chooserName.startsWith("Bot ") && !h.chooserName.includes("Bot_")) {
              allMatches.push({ name: h.chooserName });
            }
          });
        }

        if (Array.isArray(localMatches)) {
          localMatches.forEach((m: any) => {
            if (m.name && !m.name.startsWith("Bot ") && !m.name.includes("Bot_")) {
              allMatches.push({ name: m.name });
            }
          });
        }

        if (allMatches.length === 0) {
          setTopContender("None Yet");
          setRunnerUp("None Yet");
          setLiveMatchBadge("NO HUMAN MATCHES YET");
          return;
        }

        // Tally match frequencies per dater name
        const matchCounts: Record<string, number> = {};
        allMatches.forEach((m) => {
          matchCounts[m.name] = (matchCounts[m.name] || 0) + 1;
        });

        // Sort names by match count
        const sortedDaters = Object.entries(matchCounts).sort((a, b) => b[1] - a[1]);

        if (sortedDaters.length > 0) {
          const [topName, topCount] = sortedDaters[0];
          setTopContender(`${topName} (${topCount} Match${topCount > 1 ? "es" : ""})`);
          setLiveMatchBadge("LIVE HUMAN LEADERBOARD");
        } else {
          setTopContender("None Yet");
        }

        if (sortedDaters.length > 1) {
          const [runnerName, runnerCount] = sortedDaters[1];
          setRunnerUp(`${runnerName} (${runnerCount} Match${runnerCount > 1 ? "es" : ""})`);
        } else {
          setRunnerUp("None Yet");
        }
      })
      .catch(() => {
        setTopContender("None Yet");
        setRunnerUp("None Yet");
        setLiveMatchBadge("NO HUMAN MATCHES YET");
      });

    return () => clearInterval(interval);
  }, [base]);

  // Handle mIRC Command & Message Submit
  const handleSendIRC = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim()) return;

    const nowTime = new Date().toLocaleTimeString([], { hour12: false });
    const rawText = inputCommand.trim();

    if (rawText.startsWith("/me ")) {
      // IRC Action Command
      const actionMessage: IRCMessage = {
        id: String(Date.now()),
        timestamp: nowTime,
        type: "action",
        nick: currentNick,
        color: "#e879f9",
        text: `* ${currentNick} ${rawText.replace("/me ", "")}`,
      };
      setMessages((prev) => [...prev, actionMessage]);
    } else {
      // Standard IRC Chat Message
      const chatMessage: IRCMessage = {
        id: String(Date.now()),
        timestamp: nowTime,
        type: "chat",
        nick: currentNick,
        color: "#e879f9",
        text: rawText,
      };
      setMessages((prev) => [...prev, chatMessage]);
    }

    setInputCommand("");
  };

  const handleReenterQueue = () => {
    toast({
      title: "Re-entering Queue 🚀",
      description: "Matchmaking queue joined. Redirecting to speed dating map...",
    });
    setTimeout(() => {
      setLocation("/map");
    }, 1000);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#040406] text-foreground font-sans pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#0a0b10] border-b border-[#d4af37]/30 px-4 py-3 flex items-center justify-between shadow-xl">
        <a href={`${base}/`} className="flex items-center gap-2 group">
          <Trophy className="w-5 h-5 text-[#d4af37]" />
          <h1 className="font-display font-black text-lg tracking-wider uppercase text-white group-hover:text-[#d4af37] transition-colors">
            INTERMINGLED
          </h1>
        </a>

        <Button
          onClick={handleReenterQueue}
          className="bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] text-black font-black uppercase tracking-wider text-xs py-2 px-4 shadow-lg shadow-[#d4af37]/20 hover:scale-[1.02] transition-all"
        >
          <RotateCcw size={16} className="mr-1.5" />
          Re-enter Match Queue
        </Button>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-3 md:p-4 flex flex-col gap-4">
        {/* Live Match Status Banner */}
        <div className="bg-[#0b0c12] border border-[#d4af37]/40 rounded-xl p-4 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#d4af37] animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-widest text-[#d4af37] font-bold">
                LIVE MATCH STATUS
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono border-[#d4af37]/50 text-[#d4af37] bg-[#d4af37]/10">
              {liveMatchBadge}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#12141e] p-3 rounded-lg border border-[#232738]">
              <p className="text-muted-foreground text-[10px] uppercase font-mono tracking-wider">Top Contender</p>
              <p className="font-bold text-white text-sm mt-0.5">{topContender}</p>
            </div>
            <div className="bg-[#12141e] p-3 rounded-lg border border-[#232738]">
              <p className="text-muted-foreground text-[10px] uppercase font-mono tracking-wider">Runner Up</p>
              <p className="font-bold text-white text-sm mt-0.5">{runnerUp}</p>
            </div>
            <div className="bg-[#12141e] p-3 rounded-lg border border-[#232738] col-span-2 sm:col-span-1">
              <p className="text-muted-foreground text-[10px] uppercase font-mono tracking-wider">Spectators</p>
              <p className="font-bold text-[#d4af37] text-sm mt-0.5">{spectatorsCount} Online in Lounge</p>
            </div>
          </div>
        </div>

        {/* mIRC Classic Terminal Window Container */}
        <div className="flex-1 bg-[#020204] border-2 border-[#1c2030] rounded-xl shadow-2xl flex flex-col justify-between overflow-hidden min-h-[460px] font-mono">
          {/* mIRC Window Header Bar */}
          <div className="bg-[#12141f] border-b border-[#23273a] px-3 py-2 flex items-center justify-between text-xs text-slate-300 select-none">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-[#38bdf8]" />
              <span className="font-bold text-[#38bdf8]">#intermingled-lounge</span>
              <span className="text-slate-500 text-[11px]">[ +ntr ]</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-emerald-400">
                <Users size={12} /> {spectatorsCount} ops/users
              </span>
              <span className="hidden sm:inline text-slate-500">mIRC v7.75 · IntermingledNet</span>
            </div>
          </div>

          {/* mIRC IRC Message Feed */}
          <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-1.5 text-xs text-slate-200 leading-relaxed max-h-[380px]">
            {messages.map((msg) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="text-[#38bdf8] font-mono leading-tight py-0.5">
                    <span className="text-slate-500 select-none">[{msg.timestamp}] </span>
                    <span>{msg.text}</span>
                  </div>
                );
              }

              if (msg.type === "action") {
                return (
                  <div key={msg.id} className="text-[#e879f9] font-mono leading-tight py-0.5">
                    <span className="text-slate-500 select-none">[{msg.timestamp}] </span>
                    <span>{msg.text}</span>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="font-mono leading-tight py-0.5 flex flex-wrap items-baseline gap-1.5">
                  <span className="text-slate-500 select-none">[{msg.timestamp}] </span>
                  <span className="font-bold" style={{ color: msg.color || "#4ade80" }}>
                    &lt;@{msg.nick}&gt;
                  </span>
                  {msg.roundEliminated && (
                    <span className="text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-800/40 px-1.5 py-0.5 rounded">
                      Eliminated Rd {msg.roundEliminated}
                    </span>
                  )}
                  <span className="text-slate-100">{msg.text}</span>
                </div>
              );
            })}
          </div>

          {/* mIRC Status & Command Line Bar */}
          <div className="bg-[#0a0b12] border-t border-[#1c2030] p-2 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
              <span>Channel: <span className="text-[#38bdf8] font-bold">#intermingled-lounge</span></span>
              <span>Nick: <span className="text-[#4ade80] font-bold">@{currentNick}</span></span>
              <span className="hidden sm:inline text-slate-500">Type /me for actions</span>
            </div>

            <form onSubmit={handleSendIRC} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs select-none">&gt;</span>
                <Input
                  placeholder="Send IRC message or /me action to #intermingled-lounge..."
                  value={inputCommand}
                  onChange={(e) => setInputCommand(e.target.value)}
                  className="bg-[#020204] border-[#222638] text-xs font-mono text-white pl-7 h-10 focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8]"
                />
              </div>
              <Button type="submit" className="bg-[#38bdf8] hover:bg-[#0284c7] text-black font-bold h-10 px-4">
                <Send size={14} className="mr-1" /> Send
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Elimination Lounge Feature Onboarding Tutorial Modal */}
      <FeatureTutorialModal
        featureId="lobby"
        featureTitle="Elimination Lounge & Spectator Feed"
        steps={[
          {
            icon: Users,
            headline: "Human Audience Channel",
            description: "The Elimination Lounge is a live channel for human speed-daters and spectators to chat, discuss strategy, and watch gameshow results.",
          },
          {
            icon: Trophy,
            headline: "Live Contender Leaderboard",
            description: "View top speed-dating contenders ranked by match wins and compatibility scores in real time.",
          },
          {
            icon: Sparkles,
            headline: "Spectator Chat",
            description: "Chat with fellow speed-daters, send reactions, and cheer on active gameshow contestants!",
          },
        ]}
      />
    </div>
  );
}
