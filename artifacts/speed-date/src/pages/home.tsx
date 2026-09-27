import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateUser } from "@workspace/api-client-react";
import { useUser, useClerk, Show } from "@clerk/react";
import { User, MessageCircle, Lock, Clock, ArrowRight, ShieldCheck, Shield, Fingerprint, Loader2 } from "lucide-react";

const QUIZ_QUESTIONS = [
  {
    question: "How do you prefer to communicate?",
    options: [
      { label: "Deep, thoughtful conversations", score: 4 },
      { label: "Quick, playful banter", score: 3 },
      { label: "Actions over words", score: 2 },
      { label: "Short and sweet", score: 1 },
    ],
  },
  {
    question: "Ideal weekend plans?",
    options: [
      { label: "Hiking or outdoor adventure", score: 4 },
      { label: "Netflix and takeout", score: 3 },
      { label: "Exploring a new city", score: 2 },
      { label: "Hosting friends at home", score: 1 },
    ],
  },
  {
    question: "What do you value most?",
    options: [
      { label: "Loyalty and trust", score: 4 },
      { label: "Ambition and growth", score: 3 },
      { label: "Fun and spontaneity", score: 2 },
      { label: "Stability and routine", score: 1 },
    ],
  },
  {
    question: "Your humor style?",
    options: [
      { label: "Dry and sarcastic", score: 4 },
      { label: "Silly and goofy", score: 3 },
      { label: "Witty and clever", score: 2 },
      { label: "Dark and unexpected", score: 1 },
    ],
  },
  {
    question: "How do you handle conflict?",
    options: [
      { label: "Talk it out immediately", score: 4 },
      { label: "Take space then discuss", score: 3 },
      { label: "Avoid it if possible", score: 2 },
      { label: "Compromise quickly", score: 1 },
    ],
  },
  {
    question: "Your social energy?",
    options: [
      { label: "Total extrovert — love crowds", score: 4 },
      { label: "Ambivert — depends on the mood", score: 3 },
      { label: "Introvert — small groups only", score: 2 },
      { label: "Loner — prefer 1-on-1", score: 1 },
    ],
  },
  {
    question: "Relationship pace?",
    options: [
      { label: "Slow burn — let it develop", score: 4 },
      { label: "Medium — steady progress", score: 3 },
      { label: "Fast — I know what I want", score: 2 },
      { label: "Go with the flow", score: 1 },
    ],
  },
];

const QUIZ_STORAGE_KEY = "intermingled_quiz";
const SESSION_KEY = "intermingled_last_user";

interface StoredQuiz {
  name: string;
  personalityVector: number[];
}

interface CooldownInfo {
  cooldownEndsAt: string;
  sessionsToday: number;
  limit: number;
}

type Phase = "loading" | "auth" | "profile_setup" | "age_blocked" | "age_verification" | "quiz" | "role";

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const totalMins = Math.ceil(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── AGE VERIFICATION GATE ─────────────────────────────────────────────────────
function AgeVerificationGate({
  base,
  signOut,
  onVerified,
}: {
  base: string;
  signOut: () => void;
  onVerified: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/identity/start`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { url?: string; alreadyVerified?: boolean; error?: string };
      if (data.alreadyVerified) {
        onVerified();
        return;
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start verification. Please try again.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-foreground text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background">
      <div className="max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Fingerprint className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tight">Verify Your Age</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Intermingled is 18+ only. We use Stripe Identity to verify your government-issued ID and a quick selfie — no data is stored on our servers.
          </p>
        </div>

        <div className="bg-card/80 border border-border rounded-xl p-4 space-y-2 text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">Your ID is processed securely by Stripe — we only receive your verified age.</p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">One-time verification — you'll never need to repeat this.</p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">Accepted IDs: passport, driver's license, or national ID card.</p>
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm font-medium">{error}</p>
        )}

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-60 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <><Fingerprint className="w-4 h-4" /><span>Verify My Age</span><ArrowRight className="w-4 h-4" /></>
          }
        </button>

        <button
          onClick={() => signOut()}
          className="w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Sign out and come back later
        </button>
      </div>
    </div>
  );
}

function NavBar({ base, signOut, isAdmin }: { base: string; signOut: () => void; isAdmin?: boolean }) {
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
      <Show when="signed-in">
        {isAdmin && (
          <a href={`${base}/admin`} className="p-1.5 text-secondary hover:text-secondary/80 transition-colors" title="Admin Panel">
            <Shield size={18} />
          </a>
        )}
        <a href={`${base}/inbox`} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Messages">
          <MessageCircle size={18} />
        </a>
        <a href={`${base}/profile`} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="My Profile">
          <User size={18} />
        </a>
        <button onClick={signOut} className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-md transition-colors">Sign out</button>
      </Show>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [phase, setPhase] = useState<Phase>("loading");
  const [isAdmin, setIsAdmin] = useState(false);

  // Profile setup
  const [setupName, setSetupName] = useState("");
  const [setupDob, setSetupDob] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSaving, setSetupSaving] = useState(false);

  // Quiz / role
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [sessionName, setSessionName] = useState(""); // display name in room
  const [storedQuiz, setStoredQuiz] = useState<StoredQuiz | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo | null>(null);
  const [, forceUpdate] = useState(0);

  const createUser = useCreateUser();

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString()
    .split("T")[0];

  // Tick countdown
  useEffect(() => {
    if (!cooldownInfo) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [cooldownInfo]);

  // Determine phase on auth state change
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setPhase("auth");
      return;
    }

    // Signed in — fetch profile to check DOB / age verification
    fetch(`${base}/api/profile/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((profile) => {
        if (profile.isAdmin) setIsAdmin(true);
        const dob: string | null = profile.dateOfBirth ?? null;

        if (!dob) {
          // Profile incomplete — need DOB
          const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
          setSetupName(profile.name && profile.name !== "Anonymous" ? profile.name : clerkName);
          setPhase("profile_setup");
          return;
        }

        const age = calculateAge(dob);
        if (age < 18) {
          setPhase("age_blocked");
          return;
        }

        // ID verification required — check ageVerified flag
        if (!profile.ageVerified) {
          setPhase("age_verification");
          return;
        }

        // Profile verified — check for cached quiz
        const profileName = profile.name as string;
        const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as StoredQuiz;
            if (parsed.name && parsed.personalityVector?.length === 7) {
              setStoredQuiz(parsed);
              setSessionName(parsed.name || profileName);
              setPhase("role");
              return;
            }
          } catch {
            localStorage.removeItem(QUIZ_STORAGE_KEY);
          }
        }
        setSessionName(profileName);
        setPhase("quiz");
      })
      .catch(() => {
        // Network error — default to quiz if signed in
        setPhase("quiz");
      });
  }, [isLoaded, isSignedIn]);

  // ── Profile setup handlers ─────────────────────────────────────────────────
  const handleProfileSave = async () => {
    setSetupError(null);
    if (!setupDob) { setSetupError("Date of birth is required to verify your age."); return; }
    const age = calculateAge(setupDob);
    if (age < 18) { setSetupError("You must be 18 or older to use Intermingled."); return; }

    setSetupSaving(true);
    try {
      const res = await fetch(`${base}/api/profile/me`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: setupName.trim() || undefined,
          dateOfBirth: setupDob,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSetupError(err.error ?? "Failed to save profile.");
        return;
      }
      const updated = await res.json();
      const profileName = (updated.name as string) || setupName;
      setSessionName(profileName);

      // Advance to quiz (or role if quiz cached)
      const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredQuiz;
          if (parsed.name && parsed.personalityVector?.length === 7) {
            setStoredQuiz(parsed);
            setSessionName(parsed.name || profileName);
            setPhase("role");
            return;
          }
        } catch { /* fall through */ }
      }
      setPhase("quiz");
    } finally {
      setSetupSaving(false);
    }
  };

  // ── Quiz handlers ──────────────────────────────────────────────────────────
  const handleAnswer = (score: number) => {
    const next = [...answers, score];
    setAnswers(next);
    if (step < QUIZ_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setPhase("role");
    }
  };

  // ── Role selection handlers ────────────────────────────────────────────────
  const handleSubmit = async (role: "chooser" | "suitor") => {
    const displayName = sessionName.trim() || storedQuiz?.name || "";
    if (!displayName) return;
    setIsSubmitting(true);

    try {
      const vector = answers.length === 7 ? answers : storedQuiz!.personalityVector;
      const userData = await createUser.mutateAsync({
        data: { name: displayName, role, personalityVector: vector },
      });

      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: userData.id, name: displayName }));
      localStorage.setItem(
        QUIZ_STORAGE_KEY,
        JSON.stringify({ name: displayName, personalityVector: vector } satisfies StoredQuiz),
      );

      if (userData.cooldown) {
        setCooldownInfo({
          cooldownEndsAt: userData.cooldownEndsAt ?? "",
          sessionsToday: userData.sessionsToday ?? 3,
          limit: userData.chooserDailyLimit ?? 3,
        });
        return;
      }

      if (role === "suitor") {
        setLocation(`/pool?userId=${userData.id}&name=${encodeURIComponent(displayName)}`);
      } else {
        setLocation(`/match?userId=${userData.id}&name=${encodeURIComponent(displayName)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    localStorage.removeItem(QUIZ_STORAGE_KEY);
    setCooldownInfo(null);
    setStoredQuiz(null);
    setAnswers([]);
    setStep(0);
    setPhase("quiz");
  };

  const progress = ((phase === "quiz" ? step : QUIZ_QUESTIONS.length) / QUIZ_QUESTIONS.length) * 100;
  const currentQ = QUIZ_QUESTIONS[step];
  const isOnCooldown = !!cooldownInfo;
  const countdown = cooldownInfo ? formatCountdown(cooldownInfo.cooldownEndsAt) : "";

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── AUTH GATE ────────────────────────────────────────────────────────────────
  if (phase === "auth") {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="z-10 w-full max-w-sm text-center space-y-6">
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
              Intermingled
            </h1>
            <p className="text-muted-foreground font-mono text-sm mt-2">
              Real-time speed dating · 5-round elimination · find your match
            </p>
          </div>

          <div className="bg-card/80 backdrop-blur border border-primary/20 rounded-xl p-6 space-y-4 text-left">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
              <span>18+ only · age-verified via date of birth</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <User size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Create a profile before you start matching</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <ArrowRight size={16} className="text-primary mt-0.5 shrink-0" />
              <span>Answer 7 questions, then choose your role</span>
            </div>
          </div>

          <div className="space-y-3">
            <a
              href={`${base}/sign-up`}
              className="block w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest text-base flex items-center justify-center hover:bg-primary/90 hover:shadow-[0_0_25px_hsl(var(--primary)/0.4)] transition-all"
            >
              Create Account
            </a>
            <a
              href={`${base}/sign-in`}
              className="block w-full h-12 rounded-xl border-2 border-border text-muted-foreground font-bold uppercase tracking-widest text-sm flex items-center justify-center hover:border-primary/50 hover:text-foreground transition-all"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── PROFILE SETUP ────────────────────────────────────────────────────────────
  if (phase === "profile_setup") {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <NavBar base={base} signOut={signOut} isAdmin={isAdmin} />
        <div className="z-10 w-full max-w-sm">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-center mb-2">
            Intermingled
          </h1>
          <p className="text-center font-mono text-muted-foreground text-sm mb-8">
            Let's set up your profile first
          </p>

          <div className="bg-card/80 backdrop-blur border border-primary/20 rounded-xl p-8 space-y-5">
            <div className="flex items-center gap-2 text-xs font-mono text-primary/80 uppercase tracking-widest">
              <ShieldCheck size={14} /> Profile Setup
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase font-mono text-muted-foreground">Display Name</label>
              <input
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                placeholder="Your name"
                maxLength={80}
                autoFocus
                className="w-full bg-input border border-border rounded-md h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase font-mono text-muted-foreground">
                Date of Birth <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={setupDob}
                onChange={(e) => { setSetupDob(e.target.value); setSetupError(null); }}
                max={maxDob}
                className="w-full bg-input border border-border rounded-md h-12 px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              />
              <p className="text-[11px] text-muted-foreground/70 font-mono">
                You must be 18+ to use Intermingled. This is verified once and cannot be changed.
              </p>
              {setupError && <p className="text-destructive text-sm">{setupError}</p>}
            </div>

            <button
              onClick={handleProfileSave}
              disabled={setupSaving || !setupDob}
              className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {setupSaving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span>Verify & Continue</span> <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── AGE VERIFICATION (Stripe Identity) ───────────────────────────────────────
  if (phase === "age_verification") {
    return <AgeVerificationGate base={base} signOut={signOut} onVerified={() => setPhase("quiz")} />;
  }

  // ── AGE BLOCKED ───────────────────────────────────────────────────────────────
  if (phase === "age_blocked") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
        <div className="max-w-sm space-y-4">
          <div className="text-6xl">🔞</div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-destructive">18+ Only</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Intermingled is for adults aged 18 and older. Based on your date of birth, you don't meet the age requirement.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 px-6 py-3 rounded-lg border border-border text-muted-foreground font-mono text-sm hover:border-destructive/50 hover:text-destructive transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── QUIZ ─────────────────────────────────────────────────────────────────────
  if (phase === "quiz") {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <NavBar base={base} signOut={signOut} isAdmin={isAdmin} />
        <div className="z-10 w-full max-w-lg">
          <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-center">
            Intermingled
          </h1>
          <p className="text-center font-mono text-muted-foreground mb-8 text-sm">
            Answer 7 quick questions to find your matches
          </p>
          <div className="w-full bg-border rounded-full h-1.5 mb-8">
            <div
              className="bg-gradient-to-r from-primary to-secondary h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs font-mono text-muted-foreground text-center mb-6">
            QUESTION {step + 1} OF {QUIZ_QUESTIONS.length}
          </div>
          <div className="bg-card/80 backdrop-blur border border-primary/20 rounded-xl p-8 shadow-[0_0_30px_hsl(var(--primary)/0.15)]">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-8 leading-snug">{currentQ.question}</h2>
            <div className="grid grid-cols-1 gap-3">
              {currentQ.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.score)}
                  className="w-full text-left p-4 rounded-lg border border-border bg-background/50 hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_15px_hsl(var(--primary)/0.2)] transition-all font-medium text-sm active:scale-[0.98]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {step > 0 && (
            <button
              onClick={() => { setStep(step - 1); setAnswers(answers.slice(0, -1)); }}
              className="mt-4 w-full text-center text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
            >
              ← BACK
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── ROLE SELECTION ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <NavBar base={base} signOut={signOut} isAdmin={isAdmin} />

      <div className="z-10 w-full max-w-md">
        <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-center">
          Intermingled
        </h1>
        <p className="text-center font-mono text-muted-foreground mb-8 text-sm">
          {storedQuiz
            ? <>Welcome back, <span className="text-primary font-bold">{storedQuiz.name}</span>! Pick your role.</>
            : "Quiz complete! Now choose your role."}
        </p>

        <div className="bg-card/80 backdrop-blur border border-secondary/20 rounded-xl p-8 shadow-[0_0_30px_hsl(var(--secondary)/0.15)] space-y-5">
          {/* Session display name */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-mono text-muted-foreground">Your name in this session</label>
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="w-full bg-input border border-border rounded-md h-12 px-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            />
          </div>

          {/* Cooldown notice */}
          {isOnCooldown && (
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Clock size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">Chooser Cooldown Active</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  You've used {cooldownInfo!.sessionsToday}/{cooldownInfo!.limit} chooser sessions today.
                  Resets in <span className="text-amber-400 font-bold">{countdown}</span> at midnight UTC.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-xs uppercase font-mono text-muted-foreground">What's your role today?</div>

            <button
              onClick={() => handleSubmit("suitor")}
              disabled={isSubmitting || !sessionName.trim()}
              className={`w-full h-16 rounded-lg border-2 font-bold uppercase tracking-widest text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                isOnCooldown
                  ? "border-secondary bg-secondary/20 text-secondary hover:bg-secondary/30 shadow-[0_0_15px_hsl(var(--secondary)/0.2)]"
                  : "border-secondary bg-secondary/10 text-secondary hover:bg-secondary/20 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.3)]"
              }`}
            >
              I Want to Be Chosen
              <div className="text-xs font-normal font-mono mt-0.5 opacity-70">
                {isOnCooldown ? "← Your role while on cooldown" : "Enter the suitor pool"}
              </div>
            </button>

            <button
              onClick={() => !isOnCooldown && handleSubmit("chooser")}
              disabled={isSubmitting || !sessionName.trim() || isOnCooldown}
              className={`w-full h-16 rounded-lg border-2 font-bold uppercase tracking-widest text-lg transition-all active:scale-[0.98] ${
                isOnCooldown
                  ? "border-border bg-card/30 text-muted-foreground cursor-not-allowed opacity-50"
                  : "border-primary bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {isOnCooldown && <Lock size={14} className="inline mr-2 -mt-0.5" />}
              I Want to Choose
              <div className="text-xs font-normal font-mono mt-0.5 opacity-70">
                {isOnCooldown
                  ? `On cooldown · ${cooldownInfo!.sessionsToday}/${cooldownInfo!.limit} sessions used`
                  : "Find your 5 matches"}
              </div>
            </button>
          </div>

          {!isOnCooldown && (
            <p className="text-center text-[11px] font-mono text-muted-foreground/50">
              Choosers get 3 sessions · resets daily at midnight UTC
            </p>
          )}
        </div>

        <button
          onClick={handleRetakeQuiz}
          className="mt-4 w-full text-center text-xs text-muted-foreground font-mono hover:text-foreground transition-colors"
        >
          RETAKE QUIZ
        </button>
      </div>
    </div>
  );
}
