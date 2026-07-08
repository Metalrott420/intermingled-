import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";

export default function VerifyAgeResult() {
  const [, setLocation] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [status, setStatus] = useState<"checking" | "verified" | "failed" | "underage" | "processing">("checking");
  const [message, setMessage] = useState<string>("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const res = await fetch(`${base}/api/identity/status`, { credentials: "include" });
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json() as { verified: boolean; status: string; message?: string };

        if (cancelled) return;

        if (data.verified) {
          setStatus("verified");
          setTimeout(() => setLocation("/"), 2000);
          return;
        }

        if (data.status === "underage") {
          setStatus("underage");
          setMessage(data.message ?? "You must be 18 or older.");
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setMessage(data.message ?? "Verification failed. Please try again.");
          return;
        }

        if (data.status === "processing" && attempts < 6) {
          setAttempts((a) => a + 1);
          setTimeout(checkStatus, 3000);
          return;
        }

        setStatus("failed");
        setMessage("Verification could not be confirmed. Please try again.");
      } catch {
        if (!cancelled) {
          setStatus("failed");
          setMessage("Could not connect to server. Please try again.");
        }
      }
    }

    checkStatus();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
      <div className="max-w-sm space-y-5">
        {status === "checking" || status === "processing" ? (
          <>
            <Loader2 className="mx-auto w-14 h-14 text-primary animate-spin" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Checking your ID…</h1>
            <p className="text-muted-foreground text-sm">This only takes a moment.</p>
          </>
        ) : status === "verified" ? (
          <>
            <ShieldCheck className="mx-auto w-14 h-14 text-green-400" />
            <h1 className="text-2xl font-black uppercase tracking-tight text-green-400">Verified!</h1>
            <p className="text-muted-foreground text-sm">Your age is confirmed. Taking you in…</p>
          </>
        ) : status === "underage" ? (
          <>
            <ShieldX className="mx-auto w-14 h-14 text-destructive" />
            <h1 className="text-2xl font-black uppercase tracking-tight text-destructive">18+ Only</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
          </>
        ) : (
          <>
            <ShieldX className="mx-auto w-14 h-14 text-destructive" />
            <h1 className="text-2xl font-black uppercase tracking-tight">Verification Failed</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
            <a
              href={base || "/"}
              className="inline-block mt-2 px-6 py-3 rounded-lg bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              Try Again
            </a>
          </>
        )}
      </div>
    </div>
  );
}
