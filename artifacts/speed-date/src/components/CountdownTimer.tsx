import { useEffect, useMemo, useState } from 'react';

export default function CountdownTimer({ endsAt }: { endsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remainingMs = useMemo(() => {
    if (!endsAt) return null;
    const end = new Date(endsAt).getTime();
    return Math.max(0, end - now);
  }, [endsAt, now]);

  if (remainingMs === null) return null;

  const seconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs font-mono text-muted-foreground">TIME LEFT</div>
      <div className="px-2 py-1 bg-background/60 border border-border rounded-lg font-display font-black text-sm">
        {minutes > 0 ? `${minutes}:${String(sec).padStart(2, '0')}` : `${sec}s`}
      </div>
    </div>
  );
}
