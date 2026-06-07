import { useCreateUser } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
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

interface CooldownInfo {
  cooldownEndsAt: string;
  sessionsToday: number;
  limit: number;
}

function formatCountdown(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const totalMins = Math.ceil(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setUser } = useApp();
  const createUser = useCreateUser();

  const [step, setStep] = useState(0); // 0=name, 1-7=quiz, 8=role
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [answers, setAnswers] = useState<number[]>([]);
  const [role, setRole] = useState<"chooser" | "suitor" | null>(null);
  const [cooldownInfo, setCooldownInfo] = useState<CooldownInfo | null>(null);
  const [, forceUpdate] = useState(0);
  const nameRef = useRef<TextInput>(null);

  const totalSteps = 9;
  const progress = step / (totalSteps - 1);
  const styles = makeStyles(colors, insets);

  // Tick countdown every 30s when on cooldown
  useEffect(() => {
    if (!cooldownInfo) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [cooldownInfo]);

  const handleNameNext = () => {
    if (!name.trim()) { setNameError("Enter your name to continue"); return; }
    setNameError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(1);
  };

  const handleAnswer = (score: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...answers, score];
    setAnswers(next);
    if (step < 7) { setStep(step + 1); } else { setStep(8); }
  };

  const handleRoleSelect = async (selectedRole: "chooser" | "suitor") => {
    // If chooser is locked due to cooldown, redirect to suitor
    if (selectedRole === "chooser" && cooldownInfo) return;

    setRole(selectedRole);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const personalityVector = answers.slice(0, 7);

    try {
      const userData = await createUser.mutateAsync({
        data: { name: name.trim(), role: selectedRole, personalityVector },
      });

      // Handle chooser cooldown
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

      setUser({
        userId: userData.id,
        name: name.trim(),
        role: selectedRole,
        personalityVector,
      });

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
    if (step === 0) return;
    if (step === 8) { setStep(7); setCooldownInfo(null); return; }
    setAnswers(answers.slice(0, -1));
    setStep(step - 1);
  };

  const isOnCooldown = !!cooldownInfo;
  const countdown = cooldownInfo ? formatCountdown(cooldownInfo.cooldownEndsAt) : "";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>INTERMINGLED</Text>
        <Text style={styles.tagline}>Find your perfect match</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {step === 0 && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.stepContainer}>
            <Text style={styles.stepLabel}>STEP 1 OF 9</Text>
            <Text style={styles.question}>What's your name?</Text>
            <TextInput
              ref={nameRef}
              style={[styles.nameInput, nameError ? styles.nameInputError : null]}
              placeholder="Enter your name..."
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(t) => { setName(t); setNameError(""); }}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNameNext}
              maxLength={30}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            <Pressable
              style={({ pressed }) => [styles.continueBtn, { backgroundColor: colors.primary }, pressed && styles.btnPressed]}
              onPress={handleNameNext}
            >
              <Text style={[styles.continueBtnText, { color: colors.primaryForeground }]}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        )}

        {step >= 1 && step <= 7 && (
          <Animated.View key={`q${step}`} entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
            <Text style={styles.stepLabel}>STEP {step + 1} OF 9</Text>
            <Text style={styles.question}>{QUIZ_QUESTIONS[step - 1].question}</Text>
            <View style={styles.optionsContainer}>
              {QUIZ_QUESTIONS[step - 1].options.map((opt, i) => (
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

        {step === 8 && (
          <Animated.View entering={FadeIn} style={styles.stepContainer}>
            <Text style={styles.stepLabel}>STEP 9 OF 9</Text>
            <Text style={styles.question}>How do you want to play?</Text>
            <Text style={[styles.roleSubtext, { color: colors.mutedForeground }]}>
              Choose your role for this round
            </Text>

            {/* Cooldown notice */}
            {isOnCooldown && (
              <View style={[styles.cooldownBox, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" }]}>
                <Text style={styles.cooldownTitle}>⏱ Chooser Cooldown Active</Text>
                <Text style={[styles.cooldownBody, { color: colors.mutedForeground }]}>
                  You've used {cooldownInfo!.sessionsToday}/{cooldownInfo!.limit} chooser sessions today.
                  Resets in <Text style={styles.cooldownHighlight}>{countdown}</Text> at midnight UTC.
                </Text>
                <Text style={[styles.cooldownHint, { color: `${colors.mutedForeground}80` }]}>
                  Join as a suitor while you wait!
                </Text>
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
                role === "suitor" && styles.roleBtnSelected,
              ]}
              onPress={() => handleRoleSelect("suitor")}
              disabled={createUser.isPending}
            >
              <Text style={[styles.roleBtnTitle, { color: colors.secondary }]}>SUITOR</Text>
              <Text style={[styles.roleBtnDesc, { color: colors.mutedForeground }]}>
                {isOnCooldown
                  ? "← Your role while on cooldown"
                  : "Join the pool and get matched\nto a chooser automatically"}
              </Text>
            </Pressable>

            {/* Chooser button */}
            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                {
                  borderColor: isOnCooldown ? `${colors.border}` : `${colors.primary}40`,
                  backgroundColor: isOnCooldown ? `${colors.card}50` : `${colors.primary}10`,
                  opacity: isOnCooldown ? 0.45 : 1,
                },
                pressed && !isOnCooldown && styles.btnPressed,
                role === "chooser" && styles.roleBtnSelected,
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
                  : "Chat with 5 matched suitors\nand pick your favourite"}
              </Text>
            </Pressable>

            {!isOnCooldown && (
              <Text style={[styles.limitHint, { color: `${colors.mutedForeground}50` }]}>
                Signed-in choosers: 3 sessions · resets daily at midnight UTC
              </Text>
            )}

            {createUser.isPending && (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            )}
            {createUser.isError && (
              <Text style={styles.errorText}>Something went wrong. Try again.</Text>
            )}
          </Animated.View>
        )}
      </View>

      {step > 0 && (
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
    header: { alignItems: "center", paddingVertical: 24 },
    logo: { fontSize: 36, fontFamily: "Inter_700Bold", color: colors.primary, letterSpacing: 4 },
    tagline: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4, letterSpacing: 1 },
    progressTrack: { height: 2, backgroundColor: colors.border, marginHorizontal: 24, borderRadius: 1, overflow: "hidden" },
    progressFill: { height: 2, backgroundColor: colors.primary, borderRadius: 1 },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
    stepContainer: { flex: 1 },
    stepLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 2, marginBottom: 16 },
    question: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 28, lineHeight: 30 },
    optionsContainer: { gap: 10 },
    optionBtn: { borderWidth: 1, borderRadius: 8, padding: 16 },
    optionBtnPressed: { borderColor: colors.primary, backgroundColor: `${colors.primary}18` },
    optionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
    nameInput: {
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      marginBottom: 16,
    },
    nameInputError: { borderColor: colors.destructive },
    continueBtn: { borderRadius: 8, padding: 16, alignItems: "center" },
    btnPressed: { opacity: 0.8 },
    continueBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 2 },
    errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.destructive, marginBottom: 12 },
    roleSubtext: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 20, marginTop: -16 },
    cooldownBox: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
      gap: 4,
    },
    cooldownTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#f59e0b", letterSpacing: 1, textTransform: "uppercase" },
    cooldownBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
    cooldownHighlight: { color: "#f59e0b", fontFamily: "Inter_700Bold" },
    cooldownHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
    roleBtn: { borderWidth: 1, borderRadius: 10, padding: 20, marginBottom: 14 },
    roleBtnSelected: { opacity: 0.7 },
    roleBtnTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 2, marginBottom: 6 },
    roleBtnDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
    limitHint: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -6, marginBottom: 4 },
    backBtn: { alignSelf: "center", paddingVertical: 12, paddingBottom: 8 },
    backBtnText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  });
}
