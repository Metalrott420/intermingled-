import { router } from "expo-router";
import { ScrollView, Text, View, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TermsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}><Text style={s.backText}>← Back</Text></Pressable>
        <Text style={s.title}>Terms of Service</Text>
      </View>
      <View style={s.body}>
        <Text style={s.meta}>Last updated: July 5, 2026</Text>

        {sections.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}

        <Pressable onPress={() => router.push("/legal/privacy" as any)} style={{ marginTop: 24 }}>
          <Text style={s.link}>View Privacy Policy →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const sections = [
  { title: "1. Acceptance", body: "By creating an account or using Intermingled, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service." },
  { title: "2. Eligibility", body: "You must be at least 18 years old. By using the service you confirm you are 18+. We terminate underage accounts immediately." },
  { title: "3. Account Rules", body: "Provide accurate information. No fake profiles, impersonation, or catfishing. One account per person. You are responsible for all activity on your account." },
  { title: "4. Acceptable Use", body: "Do not post illegal, hateful, abusive, sexually explicit, or harmful content. Do not harass other users. Do not share contact info in speed-dating chats. No commercial solicitation or bots." },
  { title: "5. Speed-Dating Format", body: "Choosers have a daily session limit. Suitors may be eliminated. Results within each session are final. We do not guarantee matches or outcomes." },
  { title: "6. Subscriptions & Billing", body: "Some features require a paid subscription. On iOS, subscriptions are managed through Apple and subject to Apple's refund policies. Subscriptions auto-renew unless cancelled before the renewal date." },
  { title: "7. Your Content", body: "You retain ownership of content you post. By posting, you grant Intermingled a license to display it to other users. We may remove content that violates these Terms." },
  { title: "8. Safety", body: "Use the block and report tools for inappropriate behavior. We review reports and may ban accounts that violate these Terms." },
  { title: "9. Disclaimer", body: "Intermingled is provided as-is. We do not guarantee matches. Always meet new people in public places. We are not liable for in-person interactions." },
  { title: "10. Termination", body: "We may suspend or terminate your account for violations. You may delete your account at any time from your profile." },
  { title: "11. Contact", body: "Questions? Email legal@intermingled.app" },
];

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1e2230" },
  back: {},
  backText: { color: "#8b5cf6", fontSize: 15, fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "800", color: "#f0f1f5", flex: 1 },
  body: { padding: 20 },
  meta: { fontSize: 11, color: "#4a5060", marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#f0f1f5", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  sectionBody: { fontSize: 14, color: "#7d8899", lineHeight: 22 },
  link: { color: "#8b5cf6", fontSize: 14, textDecorationLine: "underline" },
});
