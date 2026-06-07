import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      <div className="z-10 text-center max-w-2xl w-full">
        <h1 className="text-5xl md:text-8xl font-black mb-4 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-md">
          FlirtFest
        </h1>
        <p className="text-xl md:text-2xl font-mono text-muted-foreground mb-12">
          5 Suitors. 1 Chooser. Clock's ticking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg mx-auto">
          <Link href="/lobby?action=host">
            <Button size="lg" className="w-full h-20 text-xl font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.5)] border border-primary/50 transition-all hover:scale-105 active:scale-95">
              Host a Room
            </Button>
          </Link>
          <Link href="/lobby?action=join">
            <Button size="lg" variant="outline" className="w-full h-20 text-xl font-bold uppercase tracking-widest border-secondary text-secondary hover:bg-secondary/10 shadow-[0_0_15px_hsl(var(--secondary)/0.3)] transition-all hover:scale-105 active:scale-95">
              Join a Room
            </Button>
          </Link>
        </div>

        <div className="mt-16 text-left border border-border p-6 bg-card/50 backdrop-blur rounded-lg shadow-2xl">
          <h2 className="text-xl font-bold text-primary mb-2 uppercase">How it works</h2>
          <ul className="space-y-2 text-muted-foreground font-mono text-sm">
            <li><strong className="text-foreground">1. Host</strong> creates a room and shares the code.</li>
            <li><strong className="text-foreground">2. Suitors</strong> join until the lobby is full (5 max).</li>
            <li><strong className="text-foreground">3. Live!</strong> The Chooser chats with all 5 at once.</li>
            <li><strong className="text-foreground">4. Decision.</strong> Host picks the winner.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
