import { router } from "expo-router";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Back</Text></Pressable>
        <Text style={s.title}>Privacy Policy</Text>
      </View>
      <View style={s.body}>
        <Text style={s.meta}>Last updated: July 5, 2026</Text>

        {sections.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <Pressable onPress={() => router.push("/legal/terms" as any)} style={{ marginTop: 24 }}>
          <Text style={s.link}>View Terms of Service →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const sections = [
  { title: "1. Who We Are", body: "Intermingled operates the Intermingled dating platform. This policy explains how we collect, use, and protect your personal data." },
  { title: "2. Data We Collect", body: "Account data (name, email, date of birth, photos), profile data (bio, gender, dating preferences, personality answers), usage data (messages, match history, likes), device data (push tokens), and payment status via Stripe." },
  { title: "3. How We Use Your Data", body: "To match you with compatible users, operate speed-dating sessions, send push notifications (with your permission), enforce safety rules, process payments, and detect abuse." },
  { title: "4. Data Sharing", body: "We do not sell your data. We share only with Clerk (auth), Stripe (payments), and Expo (push notifications). Other users see only your name, photos, bio, age, gender, and prompts — never your email." },
  { title: "5. Data Retention", body: "Profile data is kept while your account is active. Session messages are retained 90 days for moderation. You may request full deletion at any time." },
  { title: "6. Your Rights", body: "You may access, correct, delete, or export your data. Contact us at privacy@intermingled.app and we will respond within 30 days." },
  { title: "7. Children", body: "Intermingled is strictly for users 18+. We immediately delete any underage accounts discovered." },
  { title: "8. Security", body: "We use industry-standard encryption to protect your data. Use a strong password and keep your credentials private." },
  { title: "9. Contact", body: "Questions? Email privacy@intermingled.app" },
];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1e2230" },
  back: {},
  backText: { color: "#8b5cf6", fontSize: 15, fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "800", color: "#f0f1f5", flex: 1 },
  body: { padding: 20 },
  meta: { fontSize: 11, color: "#4a5060", marginBottom: 20, fontVariant: ["tabular-nums"] },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#f0f1f5", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionBody: { fontSize: 14, color: "#7d8899", lineHeight: 22 },
  link: { color: "#8b5cf6", fontSize: 14, textDecorationLine: "underline" },
});
