import { useLocation, useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";

export default function Result() {
  const params = useParams();
  const roomId = params.id as string;
  const participantId = sessionStorage.getItem(`participantId_${roomId}`);
  
  const { data: room, isLoading } = useGetRoom(roomId, { 
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId) } 
  });

  if (isLoading || !room) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-background text-primary font-mono">COMPILING RESULTS...</div>;
  }

  const isWinner = room.winnerId === participantId;
  const isChooser = room.participants.find(p => p.id === participantId)?.role === 'chooser';

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground relative overflow-hidden">
      {/* Background effect */}
      <div className={`absolute inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] ${isWinner || isChooser ? 'from-primary via-background to-background' : 'from-muted via-background to-background'}`}></div>
      
      <div className="z-10 text-center max-w-2xl w-full border border-border p-12 bg-card/60 backdrop-blur rounded-xl shadow-2xl">
        <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-8">
          Match Result
        </div>
        
        <h1 className="text-4xl md:text-6xl font-black mb-8 uppercase tracking-tighter">
          {isWinner ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-[0_0_20px_hsl(var(--primary))]">
              YOU WON
            </span>
          ) : isChooser ? (
            <span className="text-primary drop-shadow-[0_0_15px_hsl(var(--primary))]">
              MATCH CONFIRMED
            </span>
          ) : (
            <span className="text-muted-foreground">
              GAME OVER
            </span>
          )}
        </h1>

        <div className="text-xl mb-12">
          {isWinner ? (
            <div>{room.chooserName} chose you!</div>
          ) : isChooser ? (
            <div>You selected <span className="font-bold text-secondary">{room.winnerName}</span>!</div>
          ) : (
            <div>{room.chooserName} chose <span className="font-bold text-secondary">{room.winnerName}</span>.</div>
          )}
        </div>

        <Link href="/">
          <Button size="lg" className="h-14 px-8 text-lg font-bold uppercase tracking-widest bg-card border border-border hover:bg-secondary/20 hover:border-secondary hover:text-secondary transition-all">
            Play Again
          </Button>
        </Link>
      </div>
    </div>
  );
}
