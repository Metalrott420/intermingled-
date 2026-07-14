import { useAuth, useUser } from "@clerk/expo";
import { useCreateUser } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useRef, useState } from "react";
import { useSubscription } from "@/lib/revenuecat";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

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
      { label: "Ambivert — depends on mood", score: 3 },
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

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

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

// Steps: 0-6 = quiz questions (7 total), 7 = role selection
const TOTAL_STEPS = 8;

function AgeVerificationScreen({
  authFetch,
  apiBase,
  colors,
  insets,
  onVerified,
  onSignOut,
}: {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  apiBase: string;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onVerified: () => void;
  onSignOut: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${apiBase}/identity/start`, { method: "POST" });
      const data = await res.json() as { url?: string; alreadyVerified?: boolean; error?: string };
      if (data.alreadyVerified) { onVerified(); return; }
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start verification. Please try again.");
        return;
      }
      await WebBrowser.openBrowserAsync(data.url);
      setChecking(true);
      const statusRes = await authFetch(`${apiBase}/identity/status`);
      const status = await statusRes.json() as { verified: boolean; status: string; message?: string };
      if (status.verified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onVerified();
      } else if (status.status === "underage") {
        setError(status.message ?? "You must be 18 or older.");
      } else {
        setError(status.message ?? "Verification not completed. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        paddingTop: insets.top + 32,
        paddingBottom: insets.bottom + 32,
      }}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center", gap: 24, maxWidth: 360, width: "100%" }}>
        <View style={{
          width: 80, height: 80, borderRadius: 20,
          backgroundColor: `${colors.primary}20`,
          borderWidth: 1, borderColor: `${colors.primary}30`,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 36 }}>🪪</Text>
        </View>

        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "900", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>
            Verify Your Age
          </Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            Intermingled is 18+ only. We verify your government-issued ID via Stripe — your data stays private.
          </Text>
        </View>

        <View style={{ width: "100%", backgroundColor: colors.card, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.border }}>
          {["ID processed securely by Stripe — we only see your age.", "One-time only — never repeated.", "Accepted: passport, driver's license, national ID."].map((txt, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Text style={{ color: "#4ade80", fontSize: 14, marginTop: 1 }}>✓</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18, flex: 1 }}>{txt}</Text>
            </View>
          ))}
        </View>

        {error && (
          <Text style={{ color: colors.destructive ?? "#ef4444", fontSize: 13, textAlign: "center" }}>{error}</Text>
        )}

        <Pressable
          onPress={handleVerify}
          disabled={loading || checking}
          style={({ pressed }) => ({
            width: "100%", backgroundColor: colors.primary,
            borderRadius: 12, padding: 16, alignItems: "center",
            opacity: (loading || checking || pressed) ? 0.7 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1, textTransform: "uppercase" }}>
            {checking ? "Checking…" : loading ? "Opening…" : "Verify My Age →"}
          </Text>
        </Pressable>

        <Pressable onPress={onSignOut} style={{ paddingVertical: 8 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Sign out and come back later</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUser } = useApp();
  const createUser = useCreateUser();
  const { isSignedIn, isLoaded, user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const { isSubscribed } = useSubscription();

  const [phase, setPhase] = useState<Phase>("loading");

  // Profile setup
  const [setupName, setSetupName] = useState("");
  const [setupDob, setSetupDob] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSaving, setSetupSaving] = useState(false);

  // Quiz / role
  const [step, setStep] = useState(0); // 0-6 = quiz questions, 7 = role
  const [answers, setAnswers] = useState<number[]>([]);
  const [sessionName, setSessionName] = useState("");
  const [storedQuiz, setStoredQuiz] = useState<StoredQuiz | null>(null);
  const [role, setRole] = useState<"chooser" | "suitor" | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo | null>(null);
  const [, forceUpdate] = useState(0);

  // Tick countdown
  useEffect(() => {
    if (!cooldownInfo) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [cooldownInfo]);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  };

  // Determine initial phase
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setPhase("auth");
      return;
    }

    authFetch(`${API}/profile/me`)
      .then((r) => r.json())
      .then((profile) => {
        const dob: string | null = profile.dateOfBirth ?? null;

        if (!dob) {
          const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim();
          setSetupName(profile.name && profile.name !== "Anonymous" ? profile.name : clerkName);
          setPhase("profile_setup");
          return;
        }

        const age = calculateAge(dob);
        if (age < 18) {
          setPhase("age_blocked");
          return;
        }

        // ID verification required
        if (!profile.ageVerified) {
          setPhase("age_verification");
          return;
        }

        // Profile verified — skip to quiz (no cached quiz storage on mobile for now)
        const profileName = profile.name as string;
        setSessionName(profileName);
        setPhase("quiz");
      })
      .catch(() => {
        // Fallback — signed in but profile fetch failed
        setSessionName(clerkUser?.firstName ?? "");
        setPhase("quiz");
      });
  }, [isLoaded, isSignedIn]);

  const handleProfileSave = async () => {
    setSetupError(null);
    if (!setupDob.trim()) { setSetupError("Date of birth is required."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(setupDob)) { setSetupError("Use format YYYY-MM-DD"); return; }

    const age = calculateAge(setupDob);
    if (age < 18) { setSetupError("You must be 18 or older to use Intermingled."); return; }
    if (age > 120) { setSetupError("Please enter a valid date of birth."); return; }

    setSetupSaving(true);
    try {
      const res = await authFetch(`${API}/profile/me`, {
        method: "PUT",
        body: JSON.stringify({ name: setupName.trim() || undefined, dateOfBirth: setupDob }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSetupError(err.error ?? "Failed to save profile.");
        return;
      }
      const updated = await res.json();
      setSessionName((updated.name as string) || setupName);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("quiz");
    } catch {
      setSetupError("Network error. Please try again.");
    } finally {
      setSetupSaving(false);
    }
  };

  const handleAnswer = (score: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...answers, score];
    setAnswers(next);
    if (step < 6) {
      setStep(step + 1);
    } else {
      setStep(7); // role selection
    }
  };

  const handleRoleSelect = async (selectedRole: "chooser" | "suitor") => {
    if (selectedRole === "chooser" && cooldownInfo) return;
    setRole(selectedRole);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const displayName = sessionName.trim() || "Player";
    const personalityVector = answers.slice(0, 7);

    try {
      const userData = await createUser.mutateAsync({
        data: { name: displayName, role: selectedRole, personalityVector },
      });

      if (selectedRole === "chooser" && userData.cooldown) {
        setCooldownInfo({
          cooldownEndsAt: userData.cooldownEndsAt ?? "",
          sessionsToday: userData.sessionsToday ?? 3,
          limit: userData.chooserDailyLimit ?? 3,
        });
        setRole(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      setUser({ userId: userData.id, name: displayName, role: selectedRole, personalityVector });

      if (selectedRole === "suitor") {
        router.replace("/pool");
      } else {
        router.replace("/match");
      }
    } catch {
      setRole(null);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 0) { setPhase("profile_setup"); return; }
    if (step === 7) { setStep(6); setCooldownInfo(null); return; }
    setAnswers(answers.slice(0, -1));
    setStep(step - 1);
  };

  const styles = makeStyles(colors, insets);
  const isOnCooldown = !!cooldownInfo;
  const countdown = cooldownInfo ? formatCountdown(cooldownInfo.cooldownEndsAt) : "";
  const progress = step / (TOTAL_STEPS - 1);

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── AUTH GATE ────────────────────────────────────────────────────────────────
  if (phase === "auth") {
    return (
      <ScrollView contentContainerStyle={[styles.centerContainer, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.logo}>INTERMINGLED</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Real-time speed dating · Find your match</Text>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }]}>
          <Text style={[styles.infoRow, { color: colors.mutedForeground }]}>🔞  18+ only · age-verified</Text>
          <Text style={[styles.infoRow, { color: colors.mutedForeground }]}>👤  Create a profile before matching</Text>
          <Text style={[styles.infoRow, { color: colors.mutedForeground }]}>▶  7 questions · choose your role</Text>
        </View>

        <Pressable
          onPress={() => router.push("/(auth)/sign-up")}
          style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary }, pressed && styles.btnPressed]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Account</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.border }, pressed && styles.btnPressed]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.mutedForeground }]}>Sign In</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ── PROFILE SETUP ────────────────────────────────────────────────────────────
  if (phase === "profile_setup") {
    return (
      <ScrollView
        contentContainerStyle={[styles.centerContainer, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.logo}>INTERMINGLED</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>Let's set up your profile</Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: `${colors.primary}30` }]}>
          <Text style={[styles.cardLabel, { color: `${colors.primary}90` }]}>🛡 Profile Setup</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            value={setupName}
            onChangeText={setSetupName}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            maxLength={80}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Date of Birth <Text style={{ color: colors.destructive }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.input, borderColor: setupError && !setupDob ? colors.destructive : colors.border, color: colors.foreground }]}
            value={setupDob}
            onChangeText={(t) => { setSetupDob(t); setSetupError(null); }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={10}
          />
          <Text style={[styles.hint, { color: `${colors.mutedForeground}70` }]}>
            You must be 18+. Verified once, cannot be changed.
          </Text>

          {setupError && <Text style={[styles.errorText, { color: colors.destructive }]}>{setupError}</Text>}

          <Pressable
            onPress={handleProfileSave}
            disabled={setupSaving || !setupDob.trim()}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.primary, marginTop: 8 },
              (setupSaving || !setupDob.trim()) && { opacity: 0.5 },
              pressed && styles.btnPressed,
            ]}
          >
            {setupSaving
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Verify & Continue →</Text>}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── AGE VERIFICATION (Stripe Identity) ───────────────────────────────────────
  if (phase === "age_verification") {
    return (
      <AgeVerificationScreen
        authFetch={authFetch}
        apiBase={API}
        colors={colors}
        insets={insets}
        onVerified={() => {
          setPhase("quiz");
        }}
        onSignOut={() => router.replace("/(auth)/sign-in")}
      />
    );
  }

  // ── AGE BLOCKED ───────────────────────────────────────────────────────────────
  if (phase === "age_blocked") {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Text style={{ fontSize: 56 }}>🔞</Text>
        <Text style={[styles.blockedTitle, { color: colors.destructive ?? "#ef4444" }]}>18+ Only</Text>
        <Text style={[styles.blockedBody, { color: colors.mutedForeground }]}>
          Intermingled is for adults aged 18 and older. You don't meet the age requirement.
        </Text>
        <Pressable
          onPress={() => router.replace("/(auth)/sign-in")}
          style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.border, marginTop: 24 }, pressed && styles.btnPressed]}
        >
          <Text style={[styles.outlineBtnText, { color: colors.mutedForeground }]}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  // ── QUIZ + ROLE (steps 0-7) ───────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { fontSize: 28, marginBottom: 0 }]}>INTERMINGLED</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {/* Quiz questions (steps 0-6) */}
        {step >= 0 && step <= 6 && (
          <Animated.View key={`q${step}`} entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
            <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>QUESTION {step + 1} OF 7</Text>
            <Text style={[styles.question, { color: colors.foreground }]}>{QUIZ_QUESTIONS[step].question}</Text>
            <View style={{ gap: 10 }}>
              {QUIZ_QUESTIONS[step].options.map((opt, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.optionBtn,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
                  ]}
                  onPress={() => handleAnswer(opt.score)}
                >
                  <Text style={[styles.optionText, { color: colors.foreground }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Role selection (step 7) */}
        {step === 7 && (
          <Animated.View entering={FadeIn} style={styles.stepContainer}>
            <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>CHOOSE YOUR ROLE</Text>
            <Text style={[styles.question, { color: colors.foreground }]}>How do you want to play?</Text>

            {/* Session name */}
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Your name in this session</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={sessionName}
                onChangeText={setSessionName}
                maxLength={80}
              />
            </View>

            {/* Cooldown notice */}
            {isOnCooldown && (
              <View style={[styles.cooldownBox, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" }]}>
                <Text style={styles.cooldownTitle}>⏱ Chooser Cooldown Active</Text>
                <Text style={[styles.cooldownBody, { color: colors.mutedForeground }]}>
                  {cooldownInfo!.sessionsToday}/{cooldownInfo!.limit} sessions used today.
                  Resets in <Text style={{ color: "#f59e0b", fontFamily: "Inter_700Bold" }}>{countdown}</Text> at midnight UTC.
                </Text>
                {!isSubscribed && (
                  <Pressable
                    onPress={() => router.push("/subscribe")}
                    style={({ pressed }) => ({
                      marginTop: 10,
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingVertical: 10,
                      paddingHorizontal: 18,
                      alignSelf: "flex-start",
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      👑 Go Premium — Unlimited Sessions
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Suitor button */}
            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                {
                  borderColor: isOnCooldown ? colors.secondary : `${colors.secondary}40`,
                  backgroundColor: isOnCooldown ? `${colors.secondary}20` : `${colors.secondary}10`,
                },
                pressed && styles.btnPressed,
                role === "suitor" && { opacity: 0.7 },
              ]}
              onPress={() => handleRoleSelect("suitor")}
              disabled={createUser.isPending}
            >
              <Text style={[styles.roleBtnTitle, { color: colors.secondary }]}>SUITOR</Text>
              <Text style={[styles.roleBtnDesc, { color: colors.mutedForeground }]}>
                {isOnCooldown ? "← Your role while on cooldown" : "Join the pool and get matched automatically"}
              </Text>
            </Pressable>

            {/* Chooser button */}
            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                {
                  borderColor: isOnCooldown ? colors.border : `${colors.primary}40`,
                  backgroundColor: isOnCooldown ? `${colors.card}50` : `${colors.primary}10`,
                  opacity: isOnCooldown ? 0.45 : 1,
                },
                pressed && !isOnCooldown && styles.btnPressed,
                role === "chooser" && { opacity: 0.7 },
              ]}
              onPress={() => handleRoleSelect("chooser")}
              disabled={createUser.isPending || isOnCooldown}
            >
              <Text style={[styles.roleBtnTitle, { color: isOnCooldown ? colors.mutedForeground : colors.primary }]}>
                {isOnCooldown ? "🔒 CHOOSER" : "CHOOSER"}
              </Text>
              <Text style={[styles.roleBtnDesc, { color: colors.mutedForeground }]}>
                {isOnCooldown
                  ? `On cooldown · ${cooldownInfo!.sessionsToday}/${cooldownInfo!.limit} sessions today`
                  : "Chat with 5 matched suitors and pick your favourite"}
              </Text>
            </Pressable>

            {createUser.isPending && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}
            {createUser.isError && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>Something went wrong. Try again.</Text>
            )}
          </Animated.View>
        )}
      </View>

      {/* Back button */}
      {(step > 0 || phase === "quiz") && step > 0 && (
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>← Back</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: isWeb ? 67 : insets.top,
      paddingBottom: isWeb ? 34 : insets.bottom,
    },
    centerContainer: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    header: { alignItems: "center", paddingVertical: 16 },
    logo: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 4,
      textAlign: "center",
      marginBottom: 8,
    },
    tagline: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", letterSpacing: 0.5, marginBottom: 32 },
    infoCard: {
      width: "100%",
      maxWidth: 360,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      gap: 10,
      marginBottom: 24,
    },
    infoRow: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
    card: {
      width: "100%",
      maxWidth: 360,
      borderWidth: 1,
      borderRadius: 12,
      padding: 20,
      gap: 4,
    },
    cardLabel: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 },
    fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
    input: {
      height: 48,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    hint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
    errorText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
    primaryBtn: {
      width: "100%",
      maxWidth: 360,
      height: 52,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    primaryBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 1.5, textTransform: "uppercase" },
    outlineBtn: {
      width: "100%",
      maxWidth: 360,
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    outlineBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 1 },
    btnPressed: { opacity: 0.75 },
    blockedTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
    blockedBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 300 },
    progressTrack: { height: 2, backgroundColor: colors.border, marginHorizontal: 24, borderRadius: 1, overflow: "hidden" },
    progressFill: { height: 2, borderRadius: 1 },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
    stepContainer: { flex: 1 },
    stepLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" },
    question: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 24, lineHeight: 28 },
    optionBtn: { borderWidth: 1, borderRadius: 8, padding: 16 },
    optionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
    cooldownBox: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 16, gap: 4 },
    cooldownTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#f59e0b", letterSpacing: 1, textTransform: "uppercase" },
    cooldownBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
    roleBtn: { borderWidth: 1, borderRadius: 10, padding: 18, marginBottom: 12 },
    roleBtnTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" },
    roleBtnDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
    backBtn: { alignSelf: "center", paddingVertical: 12, paddingBottom: 8 },
    backBtnText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  });
}
