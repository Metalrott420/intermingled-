import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
    setStep("verify");
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (!url.startsWith("http")) {
            router.replace("/(tabs)");
          }
        },
      });
    }
  };

  const isLoading = fetchStatus === "fetching";

  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <Text style={styles.logo}>Intermingled</Text>
          <Text style={styles.subtitle}>Check your email for a verification code</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor="#7d8899"
              keyboardType="number-pad"
              autoFocus
            />
            {errors?.fields?.code && (
              <Text style={styles.error}>{errors.fields.code.message}</Text>
            )}

            <Pressable
              style={[styles.button, (!code || isLoading) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!code || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Email</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => signUp.verifications.sendEmailCode()}
            >
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Intermingled</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#7d8899"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          {errors?.fields?.emailAddress && (
            <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 characters"
            placeholderTextColor="#7d8899"
            secureTextEntry
            autoComplete="new-password"
          />
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}

          <Pressable
            style={[styles.button, (!email || !password || isLoading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!email || !password || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        {/* Required for Clerk bot protection */}
        <View nativeID="clerk-captcha" />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.link}>Sign in</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  logo: {
    fontSize: 32,
    fontWeight: "900",
    color: "#8b5cf6",
    textAlign: "center",
    letterSpacing: -1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#7d8899",
    textAlign: "center",
    marginBottom: 40,
    fontFamily: "Inter_400Regular",
  },
  form: { gap: 8 },
  label: { fontSize: 12, color: "#7d8899", textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  input: {
    backgroundColor: "#181b24",
    borderWidth: 1,
    borderColor: "#1e2230",
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    color: "#f0f1f5",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: { color: "#ef4444", fontSize: 12, marginTop: 2 },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
  secondaryButton: { alignItems: "center", marginTop: 12 },
  secondaryButtonText: { color: "#7d8899", fontSize: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#7d8899", fontSize: 14 },
  link: { color: "#8b5cf6", fontSize: 14, fontWeight: "600" },
});
