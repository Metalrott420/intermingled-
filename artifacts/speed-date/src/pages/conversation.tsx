import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Send, User } from "lucide-react";
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser || !matchId) { setLoading(false); return; }
    

    // Load own profile to get userId
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.json())
      .then((me) => setMyUserId(me.id));

    // Load match info
    fetch("/api/matches", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const match = (data.matches ?? []).find((m: MatchInfo) => m.id === matchId);
        if (match) setMatchInfo(match);
      });

    // Load messages
    fetch(`/api/matches/${matchId}/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoading(false));

    // Socket for real-time DMs
    const socket = socketIO(window.location.origin, { path: "/ws/socket.io" });
    socketRef.current = socket;
    socket.emit("join_match", { matchId });
    socket.on("dm_received", (msg: DM) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [isLoaded, clerkUser, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
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
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (isLoaded && !clerkUser && !loading) setLocation("/sign-in");
  }, [isLoaded, clerkUser, loading]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clerkUser) return null;

  const otherPhoto = matchInfo?.otherPhotos?.[0];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14 flex-shrink-0">
        <button onClick={() => setLocation("/inbox")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center flex-shrink-0">
          {otherPhoto ? (
            <img src={`/api/storage${otherPhoto}`} alt={matchInfo?.otherName} className="w-full h-full object-cover" />
          ) : (
            <User size={18} className="text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{matchInfo?.otherName ?? "Your Match"}</div>
          <div className="text-xs text-[#2bbfa8]">Matched ✓</div>
        </div>

        <button
          onClick={() => setLocation(`/profile/${matchInfo?.otherUserId}`)}
          className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
        >
          View profile
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
            <div className="text-4xl">💜</div>
            <p className="text-sm text-muted-foreground">
              You matched with <strong>{matchInfo?.otherName}</strong>!<br />
              Send the first message.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === myUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isMe
                      ? "bg-primary text-white rounded-br-sm"
                      : "bg-[#181b24] text-foreground border border-border rounded-bl-sm"
                  }`}
                >
                  <p className="leading-relaxed">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-white/60" : "text-muted-foreground"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 bg-background/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Say something..."
            maxLength={1000}
            className="flex-1 bg-[#181b24] border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
