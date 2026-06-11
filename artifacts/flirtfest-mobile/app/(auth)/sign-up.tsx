import { useSignUp } from "@clerk/expo/legacy";
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
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        "Could not create account. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        "Invalid code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!signUp) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch {
      setError("Could not resend code.");
    }
  };

  if (step === "verify") {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <Text style={styles.logo}>INTERMINGLED</Text>
          <Text style={styles.subtitle}>Check your email for a 6-digit code</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => { setCode(t); setError(null); }}
              placeholder="123456"
              placeholderTextColor="#7d8899"
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, (!code || loading) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={!code || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Verify Email</Text>}
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={handleResend}>
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => { setStep("form"); setError(null); setCode(""); }}>
              <Text style={styles.secondaryButtonText}>← Back</Text>
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
        <Text style={styles.logo}>INTERMINGLED</Text>
        <Text style={styles.subtitle}>Create your account</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            placeholder="you@example.com"
            placeholderTextColor="#7d8899"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(t) => { setPassword(t); setError(null); }}
            placeholder="Min. 8 characters"
            placeholderTextColor="#7d8899"
            secureTextEntry
            autoComplete="new-password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, (!email || !password || loading) && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!email || !password || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Create Account</Text>}
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
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#8b5cf6",
    textAlign: "center",
    letterSpacing: 4,
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
  label: {
    fontSize: 12,
    color: "#7d8899",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 8,
    fontFamily: "Inter_600SemiBold",
  },
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
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 6,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 8,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  secondaryButton: { alignItems: "center", marginTop: 14 },
  secondaryButtonText: {
    color: "#7d8899",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#7d8899", fontSize: 14, fontFamily: "Inter_400Regular" },
  link: { color: "#8b5cf6", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
