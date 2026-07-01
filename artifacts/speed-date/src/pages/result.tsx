import { useEffect, useState, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { MessageCircle, User, Send, Trophy, X, Users } from "lucide-react";
import { io as socketIO } from "socket.io-client";

interface MatchInfo {
  id: string;
  chooserUserId: string;
  suitorUserId: string;
  chooserName: string;
  suitorName: string;
}

interface GroupMsg {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string; // color token from server, e.g. "Cobalt"
  content: string;
  createdAt: string;
}

// Must match server CHAT_COLORS list and order
const COLOR_HEX: Record<string, string> = {
  Crimson: "#dc2626",
  Cobalt:  "#2563eb",
  Jade:    "#16a34a",
  Violet:  "#7c3aed",
  Amber:   "#d97706",
  Coral:   "#f43f5e",
  Teal:    "#0d9488",
  Gold:    "#ca8a04",
  Rose:    "#db2777",
  Sky:     "#0284c7",
};

export default function Result() {
  const params = useParams();
  const roomId = params.id as string;
  const participantId = sessionStorage.getItem(`participantId_${roomId}`);
  const { user: clerkUser, isLoaded } = useUser();

  const { data: room, isLoading } = useGetRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) },
  });

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<{ id: string; name: string } | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMsg[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [sendingGroup, setSendingGroup] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const groupBottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/match`)
      .then((r) => r.json())
      .then((data) => setMatchInfo(data.match ?? null))
      .finally(() => setMatchLoading(false));
  }, [roomId]);

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMyProfile({ id: data.id, name: data.name }));
  }, [isLoaded, clerkUser]);

  // Load group messages + join socket room
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/group-messages`)
      .then((r) => r.json())
      .then((data) => setGroupMessages(data.messages ?? []));

    const socket = socketIO(window.location.origin, { path: "/ws/socket.io" });
    socketRef.current = socket;
    socket.emit("join_room", { roomId });
    socket.on("group_message", (msg: GroupMsg) => {
      setGroupMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => { socket.disconnect(); };
  }, [roomId]);

  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages, showChat]);

  const handleSendGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupInput.trim() || !myProfile || sendingGroup) return;
    setGroupError(null);
    setSendingGroup(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/group-messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: groupInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroupError(data.message ?? "Could not send message.");
        return;
      }
      if (data.message) {
        setGroupMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
      setGroupInput("");
    } finally {
      setSendingGroup(false);
    }
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-xl font-black uppercase tracking-widest text-primary animate-pulse">
            COMPILING RESULTS...
          </div>
        </div>
      </div>
    );
  }

  const isWinner = room.winnerId === participantId;
  const isChooser = room.participants.find((p) => p.id === participantId)?.role === "chooser";
  const isInvolved = isWinner || isChooser;
  const isLoser = participantId && !isWinner && !isChooser;

  const participantNames = room.participants
    .filter((p) => p.role === "suitor")
    .map((p) => p.name);

  return (
    <div className={`min-h-[100dvh] w-full bg-background text-foreground relative overflow-hidden ${
      isWinner || isChooser ? "stage-bg" : "spotlight-bg"
    }`}>
      {/* Stage lights for winner/chooser */}
      {(isWinner || isChooser) && (
        <>
          <div className="stage-light-1 pointer-events-none" />
          <div className="stage-light-2 pointer-events-none" />
        </>
      )}

      <div className="relative z-10 flex flex-col items-center justify-start min-h-[100dvh] p-4 sm:p-6 py-8">
        {/* Status label */}
        <div className="mb-4 px-4 py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Episode Complete · Room {room.code}
          </span>
        </div>

        {/* Main result card */}
        <div className={`w-full max-w-xl rounded-2xl overflow-hidden border shadow-2xl mb-6 ${
          isWinner
            ? "border-secondary/60 gameshow-card-gold"
            : isChooser
              ? "border-primary/50"
              : "border-border/30"
        } bg-card/70 backdrop-blur`}>
          {/* Hero banner */}
          <div className={`p-8 sm:p-10 text-center relative overflow-hidden ${
            isWinner
              ? "bg-gradient-to-b from-secondary/15 to-transparent"
              : isChooser
                ? "bg-gradient-to-b from-primary/15 to-transparent"
                : "bg-gradient-to-b from-muted/20 to-transparent"
          }`}>
            {/* Icon */}
            {isWinner ? (
              <div className="winner-entrance mb-4 inline-block">
                <Trophy size={64} className="mx-auto text-secondary drop-shadow-[0_0_20px_hsl(var(--secondary)/0.8)]" />
              </div>
            ) : isChooser ? (
              <div className="winner-entrance mb-4 inline-block">
                <Trophy size={64} className="mx-auto text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.8)]" />
              </div>
            ) : (
              <div className="mb-4">
                <X size={56} className="mx-auto text-muted-foreground/40" />
              </div>
            )}

            <h1 className={`font-display text-5xl sm:text-7xl font-black uppercase tracking-tight leading-none mb-3 ${
              isWinner
                ? "text-transparent bg-clip-text bg-gradient-to-r from-secondary via-yellow-300 to-secondary drop-shadow-[0_0_30px_hsl(var(--secondary)/0.5)]"
                : isChooser
                  ? "text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.6)]"
                  : "text-muted-foreground"
            }`}>
              {isWinner ? "YOU WON!" : isChooser ? "MATCH CONFIRMED" : "GAME OVER"}
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground">
              {isWinner ? (
                <>
                  <span className="font-bold text-foreground">{room.chooserName}</span>
                  {" "}chose you from {participantNames.length} suitors
                </>
              ) : isChooser ? (
                <>
                  You selected{" "}
                  <span className="font-bold text-secondary">{room.winnerName}</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-foreground">{room.chooserName}</span>{" "}
                  chose{" "}
                  <span className="font-bold text-secondary">{room.winnerName}</span>
                </>
              )}
            </p>
          </div>

          {/* Match DM CTA */}
          {isInvolved && !matchLoading && (
            <div className="px-6 pb-2">
              <div className="border border-border/60 rounded-xl p-4 bg-background/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  <MessageCircle size={13} />
                  <span>Private Conversation</span>
                </div>
                {matchInfo ? (
                  isLoaded && clerkUser ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Your private channel with{" "}
                        <strong className="text-foreground">
                          {isChooser ? room.winnerName : room.chooserName}
                        </strong>{" "}
                        is open.
                      </p>
                      <Link href={`/conversation/${matchInfo.id}`}>
                        <Button className="w-full h-11 font-display font-bold tracking-widest gap-2 text-sm bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.4)]">
                          <MessageCircle size={16} />
                          OPEN PRIVATE CHAT
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Sign in to message{" "}
                        <strong>{isChooser ? room.winnerName : room.chooserName}</strong>.
                      </p>
                      <Link href="/sign-in">
                        <Button variant="outline" className="w-full h-11 font-display font-bold tracking-widest gap-2 border-primary text-primary hover:bg-primary/10">
                          <User size={16} />
                          SIGN IN TO MESSAGE
                        </Button>
                      </Link>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create an account to unlock private messaging after each session.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
            <Link href="/" className="flex-1">
              <Button
                size="lg"
                className="w-full h-12 font-display font-black uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              >
                PLAY AGAIN
              </Button>
            </Link>
            {isLoaded && clerkUser && (
              <Link href="/profile" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full h-12 font-display font-black uppercase tracking-widest border-border hover:border-primary/50 hover:text-primary"
                >
                  MY PROFILE
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* ── Post-game Group Chat (eliminated suitors only) ── */}
        {isLoser && <div className="w-full max-w-xl">
          <button
            onClick={() => setShowChat((v) => !v)}
            className="w-full flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <Users size={18} className="text-primary" />
              <div className="text-left">
                <div className="font-display font-bold uppercase tracking-wide text-sm">Post-Game Group Chat</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {groupMessages.length > 0
                    ? `${groupMessages.length} message${groupMessages.length !== 1 ? "s" : ""} · anonymous`
                    : "Eliminated players only · anonymous"}
                </div>
              </div>
            </div>
            <div className={`text-muted-foreground transition-transform ${showChat ? "rotate-90" : ""}`}>
              <ChevronRight size={18} />
            </div>
          </button>

          {showChat && (
            <div className="mt-2 rounded-xl border border-border/50 bg-card/60 backdrop-blur overflow-hidden">
              {/* Messages */}
              <div className="h-64 overflow-y-auto p-4 space-y-2">
                {groupMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs font-mono text-muted-foreground text-center">
                      Be the first to break the silence...
                    </p>
                  </div>
                ) : (
                  groupMessages.map((msg) => {
                    const isMine = myProfile && msg.senderId === myProfile.id;
                    const dotColor = COLOR_HEX[msg.senderName] ?? "#6b7280";
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="text-[10px] font-mono" style={{ color: dotColor }}>
                            {isMine ? `${msg.senderName} (you)` : msg.senderName}
                          </span>
                        </div>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          isMine
                            ? "bg-primary/20 border border-primary/40 text-foreground"
                            : "bg-muted/60 border border-border/40 text-foreground"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={groupBottomRef} />
              </div>

              {/* Input */}
              {isLoaded && clerkUser ? (
                <div className="border-t border-border/40">
                  {groupError && (
                    <div className="flex items-start gap-2 px-3 pt-2.5 pb-0">
                      <span className="text-[10px] font-mono text-elimination leading-snug">
                        🚫 {groupError}
                      </span>
                    </div>
                  )}
                  <form
                    onSubmit={handleSendGroup}
                    className="flex gap-2 p-3"
                  >
                    <input
                      value={groupInput}
                      onChange={(e) => { setGroupInput(e.target.value); if (groupError) setGroupError(null); }}
                      placeholder="Chat with everyone..."
                      className={`flex-1 bg-input border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors ${
                        groupError
                          ? "border-elimination/60 focus:ring-elimination"
                          : "border-border focus:ring-primary"
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={sendingGroup || !groupInput.trim()}
                      className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-3 border-t border-border/40 text-center text-xs text-muted-foreground font-mono">
                  <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link> to chat
                </div>
              )}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}

function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
