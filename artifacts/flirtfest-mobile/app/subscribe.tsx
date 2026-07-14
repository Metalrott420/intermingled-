import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isRevenueCatConfigured, useSubscription } from "@/lib/revenuecat";
import { useColors } from "@/hooks/useColors";

const FEATURES = [
  { icon: "♾️", title: "Unlimited Daily Sessions", body: "No more cooldowns — be a Chooser as many times as you like, every day." },
  { icon: "⚡", title: "Priority Pool Placement", body: "Jump to the front of the Suitor pool so Choosers see you first." },
  { icon: "✨", title: "Premium Badge", body: "Stand out with a premium badge on your profile." },
];

export default function SubscribeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { offerings, isPurchasing, purchase, restore, isRestoring, isSubscribed } =
    useSubscription();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentOffering = offerings?.current;
  const packageToPurchase = currentOffering?.availablePackages[0];
  const priceString = packageToPurchase?.product.priceString ?? "—";
  const productTitle = packageToPurchase?.product.title ?? "Intermingled Premium";

  if (!isRevenueCatConfigured) {
    return (
      <View
        style={[
          styles.unavailableContainer,
          { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start", paddingBottom: 8, paddingHorizontal: 20 }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 }}>
          <Text style={{ fontSize: 40 }}>🔒</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Not Available</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, textAlign: "center", lineHeight: 21 }}>
            Subscriptions are not available right now. Please check back later.
          </Text>
        </View>
      </View>
    );
  }

  const handlePurchase = async () => {
    if (!packageToPurchase) return;
    setErrorMsg(null);

    if (__DEV__) {
      setConfirmVisible(true);
      return;
    }

    try {
      await purchase(packageToPurchase);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Purchase failed. Please try again.";
      if (!msg.includes("cancelled") && !msg.includes("cancel")) {
        setErrorMsg(msg);
      }
    }
  };

  const handleConfirmedPurchase = async () => {
    setConfirmVisible(false);
    if (!packageToPurchase) return;
    setErrorMsg(null);
    try {
      await purchase(packageToPurchase);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Purchase failed. Please try again.";
      if (!msg.includes("cancelled") && !msg.includes("cancel")) {
        setErrorMsg(msg);
      }
    }
  };

  const handleRestore = async () => {
    setErrorMsg(null);
    try {
      await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setErrorMsg("Could not restore purchases. Please try again.");
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        style={{ backgroundColor: colors.background }}
      >
        {/* Header */}
        <Pressable
          onPress={() => router.back()}
          style={{ alignSelf: "flex-start", paddingBottom: 8 }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>← Back</Text>
        </Pressable>

        <View style={styles.badge}>
          <Text style={{ fontSize: 40 }}>👑</Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Go Premium</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Unlock unlimited matching and priority placement
        </Text>

        {/* Feature list */}
        <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={{ fontSize: 22, width: 36 }}>{f.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>
                  {f.title}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }}>
                  {f.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Already subscribed */}
        {isSubscribed && (
          <View
            style={[
              styles.subscribedBanner,
              { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` },
            ]}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              ✓ You have an active Premium subscription
            </Text>
          </View>
        )}

        {/* Price + CTA */}
        {!isSubscribed && (
          <>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {priceString}
              <Text style={{ fontSize: 14, color: colors.mutedForeground }}> / month</Text>
            </Text>

            {errorMsg && (
              <Text style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 8 }}>
                {errorMsg}
              </Text>
            )}

            <Pressable
              onPress={handlePurchase}
              disabled={isPurchasing || !packageToPurchase}
              style={({ pressed }) => [
                styles.ctaBtn,
                { backgroundColor: colors.primary },
                (isPurchasing || !packageToPurchase || pressed) && { opacity: 0.7 },
              ]}
            >
              {isPurchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaBtnText}>
                  {packageToPurchase ? `Subscribe to ${productTitle}` : "Loading…"}
                </Text>
              )}
            </Pressable>
          </>
        )}

        {/* Restore */}
        <Pressable
          onPress={handleRestore}
          disabled={isRestoring}
          style={{ paddingVertical: 10, alignItems: "center" }}
        >
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {isRestoring ? "Restoring…" : "Restore purchases"}
          </Text>
        </Pressable>

        <Text style={{ color: `${colors.mutedForeground}80`, fontSize: 10, textAlign: "center", marginTop: 8, paddingHorizontal: 16 }}>
          Subscription renews monthly. Cancel anytime in your device's subscription settings.
        </Text>
      </ScrollView>

      {/* Dev confirmation modal */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Test Purchase
            </Text>
            <Text style={[styles.modalBody, { color: colors.mutedForeground }]}>
              You're in development mode. This will use the RevenueCat test store — no real
              payment will be charged.{"\n\n"}Proceed with the test purchase?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmedPurchase}
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Buy (Test)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  unavailableContainer: {
    flex: 1,
  },
  container: {
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 16,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  featureCard: {
    width: "100%",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  subscribedBanner: {
    width: "100%",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  price: {
    fontSize: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  ctaBtn: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    gap: 12,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  modalBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
});
