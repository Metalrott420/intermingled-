import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, MessageCircle, Heart } from "lucide-react";

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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clerkUser) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-lg flex-1">Matches & Messages</span>
        <span className="text-xs font-mono text-muted-foreground">{matches.length} match{matches.length !== 1 ? "es" : ""}</span>
      </div>

      <div className="max-w-lg mx-auto">
        {matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart size={32} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold">No matches yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a chooser picks you — or you pick someone — your match will appear here with a private message thread.
            </p>
            <button
              onClick={() => setLocation("/")}
              className="mt-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              Start Dating
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {matches.map((match) => {
              const photo = match.otherPhotos?.[0];
              return (
                <button
                  key={match.id}
                  onClick={() => setLocation(`/conversation/${match.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-accent/50 transition-colors text-left"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                      {photo ? (
                        <img src={`/api/storage${photo}`} alt={match.otherName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-bold text-primary">
                          {match.otherName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#2bbfa8] border-2 border-background" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-sm truncate">{match.otherName}</span>
                      {match.lastMessage && (
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {timeAgo(match.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {match.lastMessage
                        ? `${match.lastMessage.senderName}: ${match.lastMessage.content}`
                        : "💜 You matched! Say hello."}
                    </p>
                  </div>

                  <MessageCircle size={18} className="text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
