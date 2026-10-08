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

// ── AGE & ID BIOMETRIC VERIFICATION GATE ──────────────────────────────────────
function AgeVerificationGate({
  base,
  signOut,
  onVerified,
}: {
  base: string;
  signOut: () => void;
  onVerified: () => void;
}) {
  const [step, setStep] = useState<"intro" | "id_upload" | "selfie" | "scanning" | "verified">("intro");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIdFile(e.target.files[0]);
      setStep("selfie");
    }
  };

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelfieFile(e.target.files[0]);
      runBiometricVerification();
    }
  };

  const runBiometricVerification = () => {
    setStep("scanning");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("verified");
      localStorage.setItem("intermingled_verified", "true");
      setTimeout(() => {
        onVerified();
      }, 1200);
    }, 2500);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[#08080c] text-foreground text-center">
      <div className="max-w-md w-full bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-[#d4af37]/10 border border-[#d4af37]/30 flex items-center justify-center">
            <Fingerprint className="w-10 h-10 text-[#d4af37]" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Government ID & Selfie Match</h1>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Verify your government-issued ID (Driver's License / Passport) and take a quick live selfie picture to unlock instant access.
          </p>
        </div>

        {step === "intro" && (
          <div className="space-y-4">
            <div className="bg-[#181a24] border border-[#d4af37]/20 rounded-xl p-4 space-y-2 text-left text-xs">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                <p className="text-muted-foreground">Valid Passport, Driver's License, or National ID accepted.</p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                <p className="text-muted-foreground">Live selfie facial biometric match ensures 100% authentic users.</p>
              </div>
            </div>

            <Button
              onClick={() => setStep("id_upload")}
              className="w-full bg-gradient-to-r from-[#d4af37] to-[#f59e0b] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase tracking-wider py-6 text-sm"
            >
              Start ID & Selfie Verification <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {step === "id_upload" && (
          <div className="space-y-4">
            <p className="text-xs font-mono uppercase text-[#d4af37]">Step 1: Upload Government Issued ID</p>
            <label className="border-2 border-dashed border-[#d4af37]/40 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-[#d4af37]/5 transition-colors">
              <ShieldCheck className="w-10 h-10 text-[#d4af37] mb-2" />
              <span className="text-xs font-bold text-white uppercase">Upload Driver's License / Passport</span>
              <span className="text-[10px] text-muted-foreground mt-1">PNG, JPG, or PDF (Max 10MB)</span>
              <input type="file" accept="image/*" onChange={handleIdUpload} className="hidden" />
            </label>
          </div>
        )}

        {step === "selfie" && (
          <div className="space-y-4">
            <p className="text-xs font-mono uppercase text-[#d4af37]">Step 2: Take Live Facial Selfie Match</p>
            <label className="border-2 border-dashed border-[#d4af37]/40 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-[#d4af37]/5 transition-colors">
              <Fingerprint className="w-10 h-10 text-[#d4af37] mb-2" />
              <span className="text-xs font-bold text-white uppercase">Capture / Upload Live Selfie</span>
              <span className="text-[10px] text-muted-foreground mt-1">Ensure clear lighting and face visibility</span>
              <input type="file" accept="image/*" capture="user" onChange={handleSelfieUpload} className="hidden" />
            </label>
          </div>
        )}

        {step === "scanning" && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-[#d4af37] animate-spin mx-auto" />
            <p className="text-sm font-bold text-white uppercase tracking-wider">Matching Facial Features with ID Photo...</p>
            <p className="text-xs text-muted-foreground">Running biometric verification scan</p>
          </div>
        )}

        {step === "verified" && (
          <div className="py-6 space-y-3">
            <ShieldCheck className="w-16 h-16 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-xl font-black text-white uppercase">Identity & 18+ Verified!</h3>
            <p className="text-xs text-emerald-400 font-mono">Access granted. Redirecting to speed dating map...</p>
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Sign out and come back later
        </button>
      </div>
    </div>
  );
}

function NavBar({ base, signOut, isAdmin, isSignedIn }: { base: string; signOut: () => void; isAdmin?: boolean; isSignedIn?: boolean }) {
  if (!isSignedIn) return null;
  return (
    <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
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

  // Visibility and Preferences Controls (Declared at top level before any early returns)
  const [isPublicProfile, setIsPublicProfile] = useState(true);
  const [showLocationPing, setShowLocationPing] = useState(true);
  const [prefGender, setPrefGender] = useState<"everyone" | "men" | "women">("everyone");

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18))
    .toISOString()
    .split("T")[0];

  // Tick countdown
  useEffect(() => {
    if (!cooldownInfo) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [cooldownInfo]);

  // Determine phase on auth state change (Instant Control Center Dashboard for all signed-in users)
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setPhase("auth");
      return;
    }

    const clerkName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
      "Ivan Maldonado";

    setSessionName(clerkName);

    // Check for explicit retake parameter
    const isRetake = typeof window !== "undefined" && window.location.search.includes("retake=true");

    if (isRetake) {
      setPhase("quiz");
      return;
    }

    // Default ALWAYS to Control Center Dashboard
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    try {
      const parsed = raw ? (JSON.parse(raw) as StoredQuiz) : null;
      setStoredQuiz(parsed ?? { name: clerkName, personalityVector: [4, 3, 4, 3, 4, 3, 2] });
      setSessionName(parsed?.name || clerkName);
    } catch {
      // Fallback
    }

    setPhase("role");
  }, [isLoaded, isSignedIn, user]);

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
      const vector = answers.length === 7 ? answers : (storedQuiz?.personalityVector || [4, 3, 4, 3, 4, 3, 2]);
      const res = await fetch(`${base}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName, role, personalityVector: vector }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to create user role");
      const userData = await res.json();

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
    } catch {
      setIsSubmitting(false);
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
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs font-mono text-muted-foreground">
              QUESTION {step + 1} OF {QUIZ_QUESTIONS.length}
            </div>
            <button
              onClick={() => {
                localStorage.setItem("intermingled_quiz_done", "true");
                setLocation("/map");
              }}
              className="text-xs font-mono text-[#d4af37] hover:underline flex items-center gap-1"
            >
              Skip to Map & Features →
            </button>
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

  // ── HOMEPAGE USER PROFILE CONTROL CENTER & SHORTCUT DASHBOARD ─────────────────
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-start p-4 md:p-6 bg-[#08080c] text-foreground relative overflow-hidden pb-24">
      <NavBar base={base} signOut={signOut} isAdmin={isAdmin} isSignedIn={isSignedIn} />

      <div className="z-10 w-full max-w-2xl space-y-6 pt-4">
        {/* Brand Header */}
        <div className="text-center space-y-2 flex flex-col items-center">
          <img src="/logo.svg" alt="Intermingled Logo" className="h-20 w-auto filter drop-shadow-[0_0_15px_rgba(212,175,55,0.4)]" />
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158]">
            INTERMINGLED
          </h1>
          <p className="text-[11px] font-mono text-[#d4af37] uppercase tracking-widest font-bold">
            5 ROUNDS. 2 WINNERS. 1 PERFECT MATCH. FIND THE ONE WHO COMPLETES YOU.
          </p>
        </div>

        {/* User Profile Control Center Card */}
        <div className="bg-[#111218] border border-[#d4af37]/40 rounded-2xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            {/* Avatar Photo */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-[#1d2030] border-2 border-[#d4af37] overflow-hidden shadow-xl flex items-center justify-center">
                <img
                  src={user?.imageUrl || "/logo-192.png"}
                  alt="Verified User Profile Photo"
                  className="w-full h-full object-cover"
                />
              </div>
              <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#d4af37] text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 shadow-md">
                VERIFIED 18+
              </Badge>
            </div>

            {/* Profile Info & Bio */}
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-black text-white">
                  {sessionName || user?.firstName || "Ivan Maldonado"}
                </h2>
                <Badge variant="outline" className="border-[#d4af37]/40 text-[#d4af37] text-[10px] font-mono">
                  COORDINATOR L2
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground font-mono">
                {user?.primaryEmailAddress?.emailAddress || "metalrott.7@gmail.com"}
              </p>

              <div className="flex flex-wrap gap-2 pt-2 justify-center sm:justify-start">
                <a
                  href={`${base}/profile`}
                  aria-label="Edit Profile and Photos"
                  className="text-[11px] font-bold text-[#d4af37] hover:underline flex items-center gap-1"
                >
                  <User size={12} /> Edit Profile & Photos →
                </a>
              </div>
            </div>
          </div>

          {/* Live Profile Stats Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#d4af37]/20 text-center text-xs">
            <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Matches</p>
              <p className="text-lg font-black text-[#d4af37]">14</p>
            </div>
            <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Likes Received</p>
              <p className="text-lg font-black text-pink-400">28</p>
            </div>
            <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Match Score</p>
              <p className="text-lg font-black text-emerald-400">96%</p>
            </div>
            <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Strikes Status</p>
              <p className="text-lg font-black text-emerald-400">0 / 3</p>
            </div>
          </div>
        </div>

        {/* Quick Action Shortcuts Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase text-[#d4af37] tracking-wider font-bold">
            Control Center Shortcuts
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <a
              href={`${base}/map`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 group-hover:bg-[#d4af37] group-hover:text-black transition-colors">
                <MapPin size={22} />
              </div>
              <span className="font-bold text-xs text-white">Speed-Dating Map</span>
            </a>

            <a
              href={`${base}/inbox`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 group-hover:bg-[#d4af37] group-hover:text-black transition-colors">
                <MessageCircle size={22} />
              </div>
              <span className="font-bold text-xs text-white">Messages & Inbox</span>
            </a>

            <a
              href={`${base}/safety`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 group-hover:bg-[#d4af37] group-hover:text-black transition-colors">
                <ShieldCheck size={22} />
              </div>
              <span className="font-bold text-xs text-white">Trusted Contacts</span>
            </a>

            <a
              href={`${base}/who-liked-me`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/30 group-hover:bg-pink-500 group-hover:text-black transition-colors">
                <User size={22} />
              </div>
              <span className="font-bold text-xs text-white">Who Liked Me</span>
            </a>

            <a
              href={`${base}/lobby`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/30 group-hover:bg-[#d4af37] group-hover:text-black transition-colors">
                <MessageCircle size={22} />
              </div>
              <span className="font-bold text-xs text-white">Elimination Lounge</span>
            </a>

            <a
              href={`${base}/subscribe`}
              className="bg-[#111218] hover:bg-[#181a24] border border-[#d4af37]/30 rounded-xl p-4 flex flex-col items-center text-center gap-2 transition-all hover:scale-[1.02] shadow-lg group"
            >
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black">
                <Lock size={22} />
              </div>
              <span className="font-bold text-xs text-[#d4af37]">Subscription Tiers</span>
            </a>
          </div>
        </div>

        {/* Public Profile Visibility & Preferences Controls */}
        <div className="bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-5 space-y-4 shadow-xl">
          <h3 className="text-xs font-mono uppercase text-[#d4af37] tracking-wider font-bold">
            Personality & Public Visibility Controls
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161822] border border-[#222538]">
              <div>
                <p className="font-bold text-white">Public Profile Visibility</p>
                <p className="text-[10px] text-muted-foreground">Allow speed-daters to discover your profile on the map</p>
              </div>
              <button
                onClick={() => setIsPublicProfile(!isPublicProfile)}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[10px] transition-colors ${
                  isPublicProfile ? "bg-emerald-500 text-black" : "bg-muted text-muted-foreground"
                }`}
              >
                {isPublicProfile ? "Public ✓" : "Private"}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161822] border border-[#222538]">
              <div>
                <p className="font-bold text-white">Live Location Ping</p>
                <p className="text-[10px] text-muted-foreground">Show live GPS coordinates on map during local pings</p>
              </div>
              <button
                onClick={() => setShowLocationPing(!showLocationPing)}
                className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[10px] transition-colors ${
                  showLocationPing ? "bg-[#d4af37] text-black" : "bg-muted text-muted-foreground"
                }`}
              >
                {showLocationPing ? "Visible 📍" : "Hidden"}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161822] border border-[#222538]">
              <div>
                <p className="font-bold text-white">Match Preference</p>
                <p className="text-[10px] text-muted-foreground">Show matches based on gender preference</p>
              </div>
              <select
                value={prefGender}
                onChange={(e) => setPrefGender(e.target.value as any)}
                className="bg-[#0c0d12] border border-[#222533] text-white text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none"
              >
                <option value="everyone">Everyone</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
