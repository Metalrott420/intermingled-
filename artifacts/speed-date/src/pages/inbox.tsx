import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, MessageCircle, Heart, Zap, Star } from "lucide-react";

interface MatchItem {
  id: string;
  roomId: string;
  chooserUserId: string;
  suitorUserId: string;
  chooserName: string;
  suitorName: string;
  otherUserId: string;
  otherName: string;
  otherPhotos: string[];
  status: string;
  createdAt: string;
  lastMessage: {
    content: string;
    createdAt: string;
    senderName: string;
  } | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function InboxPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) { setLoading(false); return; }
    fetch("/api/matches", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMatches(data.matches ?? []))
      .finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (isLoaded && !clerkUser && !loading) setLocation("/sign-in");
  }, [isLoaded, clerkUser, loading]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background stage-bg">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-sm font-black uppercase tracking-widest text-primary/60 animate-pulse">
            Loading Matches...
          </div>
        </div>
      </div>
    );
  }

  if (!clerkUser) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground stage-bg">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display font-black text-lg flex-1 uppercase tracking-wide">
          Matches &amp; Messages
        </span>
        {matches.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-secondary font-bold">
            <Star size={11} />
            {matches.length} MATCH{matches.length !== 1 ? "ES" : ""}
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto pb-12">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-5">
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.15)]">
              <Heart size={32} className="text-primary/50" />
            </div>
            <div className="space-y-2">
              <h2 className="font-display font-black text-2xl uppercase tracking-wide">No Matches Yet</h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-mono">
                When a chooser picks you — or you pick someone — your match appears here with a private message thread.
              </p>
            </div>
            <button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-display font-bold uppercase tracking-widest text-sm hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all"
            >
              <Zap size={16} /> Find a Match
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {matches.map((match) => {
              const photo = match.otherPhotos?.[0];
              return (
                <button
                  key={match.id}
                  onClick={() => setLocation(`/conversation/${match.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-primary/5 transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-primary/20 border border-border flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.1)]">
                      {photo ? (
                        <img src={`/api/storage${photo}`} alt={match.otherName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-2xl font-black text-primary/50">
                          {match.otherName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary border-2 border-background shadow-[0_0_8px_hsl(var(--secondary))]" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display font-black uppercase tracking-wide text-base truncate group-hover:text-primary transition-colors">
                        {match.otherName}
                      </span>
                      {match.lastMessage && (
                        <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0 ml-2">
                          {timeAgo(match.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-mono">
                      {match.lastMessage
                        ? `${match.lastMessage.senderName}: ${match.lastMessage.content}`
                        : "✨ You matched! Say hello."}
                    </p>
                  </div>

                  <MessageCircle size={16} className="text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
