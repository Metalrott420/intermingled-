import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { usePoolSocket } from "@/hooks/useSocket";
import { useColors } from "@/hooks/useColors";

function PulsingDot({ active, delay }: { active: boolean; delay: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(active ? 1 : 0.25);

  React.useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.5, { duration: 600 })),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0.25);
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  const colors = useColors();

  return (
    <Animated.View
      style={[
        {
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: active ? colors.secondary : colors.border,
          marginHorizontal: 4,
        },
        style,
      ]}
    />
  );
}

export default function PoolScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setParticipantId } = useApp();
  const { getToken } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((t) => setToken(t)).catch(() => {});
  }, [getToken]);

  const onMatchFound = useCallback(
    async (roomId: string, participantId: string) => {
      await setParticipantId(roomId, participantId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/room/${roomId}/suitor`);
    },
    [setParticipantId],
  );

  const { isConnected, poolCount, leavePool } = usePoolSocket(user?.userId, onMatchFound, token ?? undefined);

  const handleLeave = () => {
    leavePool();
    router.replace("/");
  };

  const styles = makeStyles(colors, insets);

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const count = poolCount ?? 0;
  const enoughPlayers = count >= 5;

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.inner}>
        {/* Radar animation */}
        <View style={styles.radarContainer}>
          <View style={[styles.radarRing, styles.radarRing3, { borderColor: `${colors.secondary}20` }]} />
          <View style={[styles.radarRing, styles.radarRing2, { borderColor: `${colors.secondary}40` }]} />
          <View style={[styles.radarRing, styles.radarRing1, { borderColor: `${colors.secondary}70` }]} />
          <View style={[styles.radarCore, { borderColor: colors.secondary }]} />
        </View>

        <Text style={styles.title}>IN THE POOL</Text>
        <Text style={styles.subtitle}>{user.name.toUpperCase()}</Text>

        {/* Live count */}
        <View style={[styles.countCard, { borderColor: enoughPlayers ? `${colors.secondary}60` : colors.border }]}>
          <Text style={[styles.countNumber, { color: enoughPlayers ? colors.secondary : colors.foreground }]}>
            {poolCount === null ? "—" : count}
          </Text>
          <Text style={styles.countLabel}>SUITORS WAITING · NEED 5</Text>
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <PulsingDot key={i} active={i < count} delay={i * 150} />
            ))}
          </View>
          {enoughPlayers && (
            <Text style={[styles.readyText, { color: colors.secondary }]}>
              ENOUGH PLAYERS — MATCH INCOMING
            </Text>
          )}
        </View>

        {/* Connection status */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.secondary : colors.mutedForeground }]} />
          <Text style={styles.statusText}>
            {isConnected ? "CONNECTED — WAITING FOR CHOOSER" : "CONNECTING..."}
          </Text>
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>WHILE YOU WAIT</Text>
          <Text style={styles.infoText}>A chooser is ranked against your personality</Text>
          <Text style={styles.infoText}>You'll be redirected the moment you match</Text>
          <Text style={styles.infoText}>Keep this screen open</Text>
        </View>

        {/* Leave */}
        {showConfirm ? (
          <View style={[styles.confirmCard, { borderColor: `${colors.destructive}40`, backgroundColor: `${colors.destructive}10` }]}>
            <Text style={[styles.confirmText, { color: colors.destructive }]}>
              Leave the pool? You'll lose your spot.
            </Text>
            <View style={styles.confirmBtns}>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { borderColor: colors.destructive }, pressed && { opacity: 0.7 }]}
                onPress={handleLeave}
              >
                <Text style={[styles.confirmBtnText, { color: colors.destructive }]}>LEAVE</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={[styles.confirmBtnText, { color: colors.mutedForeground }]}>STAY</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setShowConfirm(true)} style={styles.leaveBtn}>
            <Text style={styles.leaveBtnText}>Leave pool</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: isWeb ? 67 : insets.top,
      paddingBottom: isWeb ? 34 : insets.bottom,
    },
    inner: {
      width: "100%",
      maxWidth: 360,
      paddingHorizontal: 24,
      alignItems: "center",
    },
    radarContainer: {
      width: 100,
      height: 100,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
    },
    radarRing: {
      position: "absolute",
      borderWidth: 2,
      borderRadius: 999,
    },
    radarRing1: { width: 60, height: 60 },
    radarRing2: { width: 80, height: 80 },
    radarRing3: { width: 100, height: 100 },
    radarCore: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.secondary,
      letterSpacing: 3,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: `${colors.secondary}80`,
      letterSpacing: 2,
      marginBottom: 24,
    },
    countCard: {
      width: "100%",
      borderWidth: 1,
      borderRadius: 10,
      padding: 20,
      alignItems: "center",
      marginBottom: 16,
      backgroundColor: colors.card,
    },
    countNumber: {
      fontSize: 48,
      fontFamily: "Inter_700Bold",
      lineHeight: 56,
    },
    countLabel: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    dotsRow: {
      flexDirection: "row",
      marginBottom: 8,
    },
    readyText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.5,
      marginTop: 4,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 0.5,
    },
    infoCard: {
      width: "100%",
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
      gap: 6,
    },
    infoTitle: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 2,
      marginBottom: 4,
    },
    infoText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    confirmCard: {
      width: "100%",
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
    },
    confirmText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      textAlign: "center",
      marginBottom: 12,
    },
    confirmBtns: {
      flexDirection: "row",
      gap: 10,
    },
    confirmBtn: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 6,
      paddingVertical: 10,
      alignItems: "center",
    },
    confirmBtnText: {
      fontSize: 12,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.5,
    },
    leaveBtn: {
      paddingVertical: 8,
    },
    leaveBtnText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
}
