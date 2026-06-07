import { useCreateUser } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
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
  const nameRef = useRef<TextInput>(null);

  const totalSteps = 9; // 1 name + 7 quiz + 1 role
  const progress = step / (totalSteps - 1);

  const styles = makeStyles(colors, insets);

  const handleNameNext = () => {
    if (!name.trim()) {
      setNameError("Enter your name to continue");
      return;
    }
    setNameError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(1);
  };

  const handleAnswer = (score: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...answers, score];
    setAnswers(next);
    if (step < 7) {
      setStep(step + 1);
    } else {
      setStep(8);
    }
  };

  const handleRoleSelect = async (selectedRole: "chooser" | "suitor") => {
    setRole(selectedRole);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const personalityVector = answers.slice(0, 7);

    try {
      const userData = await createUser.mutateAsync({
        data: { name: name.trim(), role: selectedRole, personalityVector },
      });

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
    if (step === 8) {
      setStep(7);
      return;
    }
    setAnswers(answers.slice(0, -1));
    setStep(step - 1);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>FLIRTFEST</Text>
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
              style={({ pressed }) => [styles.continueBtn, pressed && styles.btnPressed]}
              onPress={handleNameNext}
            >
              <Text style={styles.continueBtnText}>CONTINUE</Text>
            </Pressable>
          </Animated.View>
        )}

        {step >= 1 && step <= 7 && (
          <Animated.View
            key={`q${step}`}
            entering={SlideInRight}
            exiting={SlideOutLeft}
            style={styles.stepContainer}
          >
            <Text style={styles.stepLabel}>STEP {step + 1} OF 9</Text>
            <Text style={styles.question}>{QUIZ_QUESTIONS[step - 1].question}</Text>
            <View style={styles.optionsContainer}>
              {QUIZ_QUESTIONS[step - 1].options.map((opt, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.optionBtn, pressed && styles.optionBtnPressed]}
                  onPress={() => handleAnswer(opt.score)}
                >
                  <Text style={styles.optionText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {step === 8 && (
          <Animated.View entering={FadeIn} style={styles.stepContainer}>
            <Text style={styles.stepLabel}>STEP 9 OF 9</Text>
            <Text style={styles.question}>How do you want to play?</Text>
            <Text style={styles.roleSubtext}>
              Choose your role for this round
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                styles.roleBtnChooser,
                pressed && styles.btnPressed,
                role === "chooser" && styles.roleBtnSelected,
              ]}
              onPress={() => handleRoleSelect("chooser")}
              disabled={createUser.isPending}
            >
              <Text style={[styles.roleBtnTitle, { color: colors.primary }]}>CHOOSER</Text>
              <Text style={styles.roleBtnDesc}>Chat with 5 matched suitors{"\n"}and pick your favourite</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                styles.roleBtnSuitor,
                pressed && styles.btnPressed,
                role === "suitor" && styles.roleBtnSelected,
              ]}
              onPress={() => handleRoleSelect("suitor")}
              disabled={createUser.isPending}
            >
              <Text style={[styles.roleBtnTitle, { color: colors.secondary }]}>SUITOR</Text>
              <Text style={styles.roleBtnDesc}>Join the pool and get matched{"\n"}to a chooser automatically</Text>
            </Pressable>

            {createUser.isPending && (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            )}
            {createUser.isError && (
              <Text style={styles.errorText}>Something went wrong. Try again.</Text>
            )}
          </Animated.View>
        )}
      </View>

      {/* Back button */}
      {step > 0 && (
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>← Back</Text>
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
    header: {
      alignItems: "center",
      paddingVertical: 24,
    },
    logo: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 4,
    },
    tagline: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 4,
      letterSpacing: 1,
    },
    progressTrack: {
      height: 2,
      backgroundColor: colors.border,
      marginHorizontal: 24,
      borderRadius: 1,
      overflow: "hidden",
    },
    progressFill: {
      height: 2,
      backgroundColor: colors.primary,
      borderRadius: 1,
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 32,
    },
    stepContainer: {
      flex: 1,
    },
    stepLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 2,
      marginBottom: 16,
    },
    question: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 28,
      lineHeight: 30,
    },
    optionsContainer: {
      gap: 10,
    },
    optionBtn: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
    },
    optionBtnPressed: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}18`,
    },
    optionText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
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
    nameInputError: {
      borderColor: colors.destructive,
    },
    continueBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
    },
    btnPressed: {
      opacity: 0.8,
    },
    continueBtnText: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.primaryForeground,
      letterSpacing: 2,
    },
    errorText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.destructive,
      marginBottom: 12,
    },
    roleSubtext: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 24,
      marginTop: -16,
    },
    roleBtn: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 20,
      marginBottom: 14,
    },
    roleBtnChooser: {
      borderColor: `${colors.primary}40`,
      backgroundColor: `${colors.primary}10`,
    },
    roleBtnSuitor: {
      borderColor: `${colors.secondary}40`,
      backgroundColor: `${colors.secondary}10`,
    },
    roleBtnSelected: {
      opacity: 0.7,
    },
    roleBtnTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      letterSpacing: 2,
      marginBottom: 6,
    },
    roleBtnDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    backBtn: {
      alignSelf: "center",
      paddingVertical: 12,
      paddingBottom: 8,
    },
    backBtnText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
}
