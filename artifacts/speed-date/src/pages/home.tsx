import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useCreateUser } from "@workspace/api-client-react";
import { useUser, useClerk, Show } from "@clerk/react";

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

// Only cache the quiz answers and name — never the userId.
// Each role selection always creates a fresh server-side user with the correct role,
// so status lifecycle and role assignment are always accurate.
const STORAGE_KEY = "intermingled_quiz";

interface StoredQuiz {
  name: string;
  personalityVector: number[];
}

type Phase = "quiz" | "role";

export default function Home() {
  const [, setLocation] = useLocation();
  const [phase, setPhase] = useState<Phase>("quiz");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [storedQuiz, setStoredQuiz] = useState<StoredQuiz | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const createUser = useCreateUser();

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredQuiz;
        if (parsed.name && parsed.personalityVector?.length === 7) {
          setStoredQuiz(parsed);
          setName(parsed.name);
          setPhase("role");
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleAnswer = (score: number) => {
    const next = [...answers, score];
    setAnswers(next);
    if (step < QUIZ_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setPhase("role");
    }
  };

  const handleSubmit = async (role: "chooser" | "suitor") => {
    const displayName = name.trim() || storedQuiz?.name || "";
    if (!displayName) return;
    setIsSubmitting(true);

    try {
      const vector = answers.length === 7 ? answers : storedQuiz!.personalityVector;

      // Always create a fresh user with the chosen role so:
      //   1. Role is always correct server-side (choosers can't end up as suitors)
      //   2. Status starts as 'looking' — clean lifecycle each session
      const user = await createUser.mutateAsync({
        data: { name: displayName, role, personalityVector: vector },
      });

      // Cache quiz answers + name for next visit (not userId — a fresh user is
      // created each session so there's no stale status to carry over)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name: displayName, personalityVector: vector } satisfies StoredQuiz),
      );

      if (role === "suitor") {
        setLocation(`/pool?userId=${user.id}&name=${encodeURIComponent(displayName)}`);
      } else {
        setLocation(`/match?userId=${user.id}&name=${encodeURIComponent(displayName)}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStoredQuiz(null);
    setAnswers([]);
    setStep(0);
    setName("");
    setPhase("quiz");
  };

  const progress = ((phase === "quiz" ? step : QUIZ_QUESTIONS.length) / QUIZ_QUESTIONS.length) * 100;
  const currentQ = QUIZ_QUESTIONS[step];

  if (phase === "quiz") {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background relative overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

        {/* Auth nav bar */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <Show when="signed-out">
            <a href={`${base}/sign-in`} className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-md transition-colors">Sign in</a>
            <a href={`${base}/subscribe`} className="text-xs font-mono bg-primary text-white px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">Subscribe</a>
          </Show>
          <Show when="signed-in">
            <span className="text-xs font-mono text-muted-foreground">{user?.firstName ?? user?.primaryEmailAddress?.emailAddress}</span>
            <button onClick={() => signOut()} className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded-md transition-colors">Sign out</button>
          </Show>
        </div>

        <div className="z-10 w-full max-w-lg">
          <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-center">
            Intermingled
          </h1>
          <p className="text-center font-mono text-muted-foreground mb-8 text-sm">
            Find your perfect match — answer 7 quick questions
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
            <h2 className="text-xl md:text-2xl font-bold text-center mb-8 leading-snug">
              {currentQ.question}
            </h2>

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

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/20 via-background to-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 w-full max-w-md">
        <h1 className="text-4xl md:text-5xl font-black mb-2 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-center">
          Intermingled
        </h1>

        {storedQuiz ? (
          <p className="text-center font-mono text-muted-foreground mb-8 text-sm">
            Welcome back, <span className="text-primary font-bold">{storedQuiz.name}</span>! Pick your role.
          </p>
        ) : (
          <p className="text-center font-mono text-muted-foreground mb-8 text-sm">
            Quiz complete! Now tell us who you are.
          </p>
        )}

        <div className="bg-card/80 backdrop-blur border border-secondary/20 rounded-xl p-8 shadow-[0_0_30px_hsl(var(--secondary)/0.15)] space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase font-mono text-muted-foreground">Your Name</label>
            <input
              placeholder="Enter your name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-input border border-border rounded-md h-12 px-4 text-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              autoFocus={!storedQuiz}
            />
          </div>

          <div className="space-y-3">
            <div className="text-xs uppercase font-mono text-muted-foreground">What's your role today?</div>

            <button
              onClick={() => handleSubmit("suitor")}
              disabled={isSubmitting || !name.trim()}
              className="w-full h-16 rounded-lg border-2 border-secondary bg-secondary/10 text-secondary font-bold uppercase tracking-widest text-lg hover:bg-secondary/20 hover:shadow-[0_0_20px_hsl(var(--secondary)/0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Want to Be Chosen
              <div className="text-xs font-normal font-mono mt-0.5 opacity-70">Enter the suitor pool</div>
            </button>

            <button
              onClick={() => handleSubmit("chooser")}
              disabled={isSubmitting || !name.trim()}
              className="w-full h-16 rounded-lg border-2 border-primary bg-primary/10 text-primary font-bold uppercase tracking-widest text-lg hover:bg-primary/20 hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I Want to Choose
              <div className="text-xs font-normal font-mono mt-0.5 opacity-70">Find your 5 matches</div>
            </button>
          </div>
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
