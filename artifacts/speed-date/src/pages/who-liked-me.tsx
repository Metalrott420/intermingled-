import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { ArrowLeft, Heart, Star, Zap } from "lucide-react";

interface Liker {
  id: string;
  name: string;
  bio: string | null;
  photos: string[];
  likedAt: string;
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

export default function WhoLikedMe() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedBack, setLikedBack] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) { setLoading(false); return; }
    fetch("/api/users/who-liked-me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setLikers(data.likers ?? []))
      .finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (isLoaded && !clerkUser && !loading) setLocation("/sign-in");
  }, [isLoaded, clerkUser, loading]);

  const handleLikeBack = async (id: string) => {
    setLikedBack((prev) => new Set([...prev, id]));
    fetch(`/api/users/${id}/like`, { method: "POST", credentials: "include" }).catch(() => {});
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!clerkUser) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground stage-bg">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display font-black text-lg flex-1 uppercase tracking-wide">Who Liked You</span>
        {likers.length > 0 && (
          <span className="text-xs font-mono text-secondary font-bold">{likers.length} LIKE{likers.length !== 1 ? "S" : ""}</span>
        )}
      </div>

      <div className="max-w-lg mx-auto pb-12">
        {likers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
              <Heart size={32} className="text-secondary/40" />
            </div>
            <h2 className="font-display font-black text-2xl uppercase tracking-wide">No Likes Yet</h2>
            <p className="text-sm text-muted-foreground leading-relaxed font-mono">
              When someone browses the pool and likes you, they'll show up here. Get out there and compete!
            </p>
            <button
              onClick={() => setLocation("/")}
              className="mt-2 flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-display font-bold uppercase tracking-widest text-sm hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
            >
              <Zap size={16} /> Start Dating
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest text-center py-2">
              These people liked your profile while browsing
            </p>
            {likers.map((liker) => {
              const photo = liker.photos?.[0];
              const isLikedBack = likedBack.has(liker.id);
              return (
                <div key={liker.id} className="gameshow-card flex items-center gap-4 p-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-border">
                    {photo ? (
                      <img src={`/api/storage${photo}`} alt={liker.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-2xl font-black text-primary/50">
                        {liker.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black text-lg uppercase tracking-wide">{liker.name}</div>
                    {liker.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{liker.bio}</p>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">{timeAgo(liker.likedAt)}</p>
                  </div>
                  <button
                    onClick={() => handleLikeBack(liker.id)}
                    disabled={isLikedBack}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold font-display uppercase transition-all ${
                      isLikedBack
                        ? "bg-secondary/20 text-secondary border border-secondary/40 cursor-not-allowed"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_0_12px_hsl(var(--secondary)/0.3)]"
                    }`}
                  >
                    <Star size={12} />
                    {isLikedBack ? "LIKED!" : "LIKE"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
