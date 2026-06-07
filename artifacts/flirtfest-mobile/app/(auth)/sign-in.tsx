import { useSignIn } from "@clerk/expo";
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

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/");
          if (url.startsWith("http")) {
            // no-op in native
          } else {
            router.replace("/(tabs)");
          }
        },
      });
    }
  };

  const isLoading = fetchStatus === "fetching";
  const canSubmit = !!email && !!password && !isLoading;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Intermingled</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

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
          {errors?.fields?.identifier && (
            <Text style={styles.error}>{errors.fields.identifier.message}</Text>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#7d8899"
            secureTextEntry
            autoComplete="password"
          />
          {errors?.fields?.password && (
            <Text style={styles.error}>{errors.fields.password.message}</Text>
          )}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.link}>Sign up</Text>
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "#7d8899", fontSize: 14 },
  link: { color: "#8b5cf6", fontSize: 14, fontWeight: "600" },
});
