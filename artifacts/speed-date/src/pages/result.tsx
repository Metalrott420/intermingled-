import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { MessageCircle, User } from "lucide-react";

interface MatchInfo {
  id: string;
  chooserUserId: string;
  suitorUserId: string;
  chooserName: string;
  suitorName: string;
}

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

  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/rooms/${roomId}/match`)
      .then((r) => r.json())
      .then((data) => setMatchInfo(data.match ?? null))
      .finally(() => setMatchLoading(false));
  }, [roomId]);

  if (isLoading || !room) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">
        COMPILING RESULTS...
      </div>
    );
  }

  const isWinner = room.winnerId === participantId;
  const isChooser = room.participants.find((p) => p.id === participantId)?.role === "chooser";
  const isInvolved = isWinner || isChooser;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground relative overflow-hidden">
      {/* Background glow */}
      <div
        className={`absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${
          isInvolved
            ? "from-primary via-background to-background"
            : "from-muted via-background to-background"
        }`}
      />

      <div className="z-10 text-center max-w-2xl w-full border border-border p-10 bg-card/60 backdrop-blur rounded-xl shadow-2xl space-y-6">
        <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
          Match Result
        </div>

        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">
          {isWinner ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_20px_hsl(var(--primary))]">
              YOU WON
            </span>
          ) : isChooser ? (
            <span className="text-primary drop-shadow-[0_0_15px_hsl(var(--primary))]">
              MATCH CONFIRMED
            </span>
          ) : (
            <span className="text-muted-foreground">GAME OVER</span>
          )}
        </h1>

        <div className="text-xl">
          {isWinner ? (
            <p>
              <span className="font-bold text-secondary">{room.chooserName}</span> chose you!
            </p>
          ) : isChooser ? (
            <p>
              You selected <span className="font-bold text-secondary">{room.winnerName}</span>!
            </p>
          ) : (
            <p>
              {room.chooserName} chose{" "}
              <span className="font-bold text-secondary">{room.winnerName}</span>.
            </p>
          )}
        </div>

        {/* Match DM CTA — only for the two people involved */}
        {isInvolved && !matchLoading && (
          <div className="border border-border rounded-xl p-6 bg-background/60 space-y-3 text-left">
            <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground uppercase tracking-wider">
              <MessageCircle size={14} />
              <span>Private Message</span>
            </div>

            {matchInfo ? (
              isLoaded && clerkUser ? (
                // Signed in → go straight to conversation
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You have a private conversation with{" "}
                    <strong>{isChooser ? room.winnerName : room.chooserName}</strong>.
                  </p>
                  <Link href={`/conversation/${matchInfo.id}`}>
                    <Button className="w-full h-11 font-bold tracking-widest gap-2">
                      <MessageCircle size={16} />
                      OPEN CONVERSATION
                    </Button>
                  </Link>
                </div>
              ) : (
                // Not signed in → prompt to sign in
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sign in to message{" "}
                    <strong>{isChooser ? room.winnerName : room.chooserName}</strong>{" "}
                    and keep the spark going.
                  </p>
                  <Link href="/sign-in">
                    <Button variant="outline" className="w-full h-11 font-bold tracking-widest gap-2 border-primary text-primary hover:bg-primary/10">
                      <User size={16} />
                      SIGN IN TO MESSAGE
                    </Button>
                  </Link>
                </div>
              )
            ) : (
              // Match not yet created (e.g. both users anonymous)
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {isLoaded && clerkUser
                    ? "Sign in before your next session to unlock private messaging with your match."
                    : "Create an account to unlock private messaging after each session."}
                </p>
                <Link href={clerkUser ? "/inbox" : "/sign-up"}>
                  <Button variant="outline" className="w-full h-11 font-bold tracking-widest gap-2 border-primary/50 text-primary hover:bg-primary/10">
                    <User size={16} />
                    {clerkUser ? "VIEW INBOX" : "CREATE ACCOUNT"}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/" className="flex-1">
            <Button
              size="lg"
              className="w-full h-12 font-bold uppercase tracking-widest bg-card border border-border hover:bg-secondary/20 hover:border-secondary hover:text-secondary transition-all"
            >
              Play Again
            </Button>
          </Link>
          {isLoaded && clerkUser && (
            <Link href="/profile" className="flex-1">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-12 font-bold uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10 transition-all"
              >
                My Profile
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
