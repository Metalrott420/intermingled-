export default function RoundProgress({ currentRound, numberOfRounds }: { currentRound: number; numberOfRounds: number }) {
  const pct = Math.round((currentRound / numberOfRounds) * 100);
  return (
    <div className="w-40">
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className="h-2 bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-1">Round {currentRound} / {numberOfRounds}</div>
    </div>
  );
}
