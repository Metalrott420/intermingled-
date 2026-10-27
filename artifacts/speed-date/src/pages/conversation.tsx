import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send, Heart } from "lucide-react";
import { io as socketIO } from "socket.io-client";

interface DM {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface MatchInfo {
  id: string;
  otherName: string;
  otherPhotos: string[];
  otherUserId: string;
  chooserUserId: string;
  suitorUserId: string;
}

export default function ConversationPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser || !matchId) { setLoading(false); return; }

    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me) => setMyUserId(me.id));

    fetch("/api/matches", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const match = (data.matches ?? []).find((m: MatchInfo) => m.id === matchId);
        if (match) setMatchInfo(match);
      });

    fetch(`/api/matches/${matchId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      })
      .finally(() => setLoading(false));

    // Fallback: Check local match storage
    const localMatchesRaw = localStorage.getItem("intermingled_matches");
    if (localMatchesRaw) {
      try {
        const localMatches = JSON.parse(localMatchesRaw);
        const currentMatch = localMatches.find((m: any) => m.id === matchId);
        if (currentMatch) {
          setMatchInfo({
            id: currentMatch.id,
            otherName: currentMatch.otherName,
            otherPhotos: currentMatch.otherPhotos || ["/logo-192.png"],
            otherUserId: currentMatch.otherUserId,
            chooserUserId: "me",
            suitorUserId: currentMatch.otherUserId,
          });

          setMessages((prev) => {
            if (prev.length === 0) {
              return [
                {
                  id: `welcome-${matchId}`,
                  matchId,
                  senderId: "system",
                  senderName: "Intermingled Matchmaker",
                  content: `🎉 CONGRATULATIONS! You and ${currentMatch.otherName} matched in 3-Round Speed Dating! You can now chat 1-on-1, share photos, and stay connected!`,
                  createdAt: new Date().toISOString(),
                },
              ];
            }
            return prev;
          });
        }
      } catch {}
    }

    const socket = socketIO(window.location.origin, { path: "/ws/socket.io" });
    socketRef.current = socket;
    socket.emit("join_match", { matchId });
    socket.on("dm_received", (msg: DM) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    socket.on("typing", ({ matchId: mid }: { matchId: string; userId: string }) => {
      if (mid === matchId) {
        setIsTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
      }
    });

    return () => { socket.disconnect(); };
  }, [isLoaded, clerkUser, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const checkAISafetyViolation = (text: string): { isViolation: boolean; reason?: string } => {
    const lower = text.toLowerCase();
    if (/nude|naked|explicit|nsfw|sex|porn/i.test(lower)) {
      return { isViolation: true, reason: "Explicit content or nudity solicitation is strictly prohibited." };
    }
    if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b|\b(?:\d[ -]*?){13,16}\b|routing|bank account|cashapp|venmo|zelle/i.test(lower)) {
      return { isViolation: true, reason: "Sharing sensitive PII or financial accounts is blocked for user safety." };
    }
    if (/harass|threat|stalk|abuse|hate speech/i.test(lower)) {
      return { isViolation: true, reason: "Abusive or harassing language is blocked by AI Moderation." };
    }
    return { isViolation: false };
  };

  const [safetyViolationMessage, setSafetyViolationMessage] = useState<string | null>(null);

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    const violation = checkAISafetyViolation(content.trim());
    if (violation.isViolation) {
      setSafetyViolationMessage(violation.reason || "Safety policy violation detected.");
      const strikes = Number(localStorage.getItem("intermingled_strikes") || 0) + 1;
      localStorage.setItem("intermingled_strikes", String(strikes));
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setContent("");
      }
    } finally { setSending(false); }
  };

  const handleTyping = (val: string) => {
    setContent(val);
    if (socketRef.current && matchId) {
      socketRef.current.emit("typing", { matchId, userId: myUserId });
    }
  };

  useEffect(() => {
    if (isLoaded && !clerkUser && !loading) setLocation("/sign-in");
  }, [isLoaded, clerkUser, loading]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background stage-bg">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-sm font-black uppercase tracking-widest text-primary/60 animate-pulse">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!clerkUser) return null;

  const otherPhoto = matchInfo?.otherPhotos?.[0];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col stage-bg">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button onClick={() => setLocation("/inbox")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>

        <div className="w-9 h-9 rounded-xl overflow-hidden bg-primary/20 border border-border flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_hsl(var(--primary)/0.15)]">
          {otherPhoto ? (
            <img src={`/api/storage${otherPhoto}`} alt={matchInfo?.otherName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display font-black text-sm text-primary">
              {matchInfo?.otherName?.charAt(0)?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-display font-black uppercase tracking-wide text-base truncate">
            {matchInfo?.otherName ?? "Your Match"}
          </div>
          <div className="text-[10px] font-mono text-secondary flex items-center gap-1">
            <Heart size={9} className="fill-secondary" /> Matched
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !isTyping ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Heart size={28} className="text-primary/50" />
            </div>
            <div>
              <p className="font-display font-black text-xl uppercase tracking-wide">You Matched!</p>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                Say hi to <strong className="text-foreground">{matchInfo?.otherName}</strong>
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMe
                    ? "bg-primary/90 text-primary-foreground rounded-br-sm shadow-[0_0_15px_hsl(var(--primary)/0.25)]"
                    : "bg-card border border-border/80 text-foreground rounded-bl-sm"
                }`}>
                  <p className="leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1 font-mono ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/80 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 bg-background/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <input
            value={content}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`Message ${matchInfo?.otherName ?? "your match"}...`}
            maxLength={1000}
            className="flex-1 bg-input border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0 shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={16} />}
          </button>
        </div>
      </div>

      {/* AI Safety Governor Modal */}
      {safetyViolationMessage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-red-500 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.4)]">
            <div className="text-4xl text-red-500">⛔</div>
            <h3 className="text-lg font-black text-red-500 uppercase tracking-wider">
              MESSAGE BLOCKED BY AI SAFETY GOVERNOR
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {safetyViolationMessage}
            </p>
            <div className="bg-red-950/60 border border-red-800/40 p-3 rounded-xl text-left text-[11px] font-mono text-red-300">
              <p className="font-bold text-red-400 uppercase">Warning Issued:</p>
              <p>• A Strike has been logged on your account.</p>
              <p>• Sharing explicit material or PII violates safety rules.</p>
            </div>
            <button
              onClick={() => setSafetyViolationMessage(null)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs py-3 rounded-xl"
            >
              I Understand & Will Comply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
