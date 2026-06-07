import { useMatchRoom, MatchResult } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useChooserSocket } from "@/hooks/useSocket";
import { useColors } from "@/hooks/useColors";

interface FilledSlot {
  slot: number;
  suitorName: string;
}

function SlotBox({ slot, filled }: { slot: number; filled: FilledSlot | undefined }) {
  const colors = useColors();
  return (
    <Animated.View
      entering={filled ? ZoomIn : undefined}
      style={[
        {
          width: 56,
          height: 56,
          borderRadius: 8,
          borderWidth: 2,
          alignItems: "center",
          justifyContent: "center",
          borderColor: filled ? colors.secondary : colors.border,
          backgroundColor: filled ? `${colors.secondary}20` : colors.card,
        },
      ]}
    >
      <Text style={{
        fontSize: filled ? 11 : 13,
        fontFamily: "Inter_700Bold",
        color: filled ? colors.secondary : colors.mutedForeground,
      }}>
        {filled ? filled.suitorName.slice(0, 2).toUpperCase() : String(slot)}
      </Text>
    </Animated.View>
  );
}

export default function MatchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, setParticipantId } = useApp();
  const matchRoom = useMatchRoom();

  const [filledSlots, setFilledSlots] = useState<FilledSlot[]>([]);
  const [matching, setMatching] = useState(false);
  const [notEnoughCount, setNotEnoughCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const chooserParticipantIdRef = useRef<string | null>(null);
  const redirectedRef = useRef(false);

  const onSlotFilled = useCallback((slot: number, suitorName: string) => {
    setFilledSlots((prev) => {
      if (prev.some((s) => s.slot === slot)) return prev;
      const next = [...prev, { slot, suitorName }];
      if (
        next.length >= 5 &&
        roomIdRef.current &&
        chooserParticipantIdRef.current &&
        !redirectedRef.current
      ) {
        redirectedRef.current = true;
        setParticipantId(roomIdRef.current, chooserParticipantIdRef.current).then(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => router.replace(`/room/${roomIdRef.current}/chooser`), 600);
        });
      }
      return next;
    });
  }, [setParticipantId]);

  const { isConnected, poolCount } = useChooserSocket(user?.userId, onSlotFilled);

  // Auto-clear "not enough" error when pool fills up
  React.useEffect(() => {
    if (notEnoughCount !== null && poolCount !== null && poolCount >= 5) {
      setNotEnoughCount(null);
    }
  }, [poolCount, notEnoughCount]);

  const handleFindMatches = () => {
    if (!user) return;
    setError(null);
    setNotEnoughCount(null);
    setFilledSlots([]);
    redirectedRef.current = false;
    setMatching(true);

    matchRoom.mutate(
      { data: { chooserUserId: user.userId } },
      {
        onSuccess: (data: MatchResult) => {
          roomIdRef.current = data.id;
          chooserParticipantIdRef.current = data.chooserParticipantId;

          setTimeout(() => {
            if (redirectedRef.current) return;
            const suitors: FilledSlot[] = data.participants
              .filter((p: any) => p.role === "suitor" && p.suitorSlot != null)
              .map((p: any) => ({ slot: p.suitorSlot as number, suitorName: p.name }))
              .sort((a: FilledSlot, b: FilledSlot) => a.slot - b.slot);

            if (suitors.length > 0) {
              setFilledSlots(suitors);
              if (suitors.length >= 5 && !redirectedRef.current) {
                redirectedRef.current = true;
                setParticipantId(data.id, data.chooserParticipantId).then(() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setTimeout(() => router.replace(`/room/${data.id}/chooser`), 600);
                });
              }
            }
          }, 600);
        },
        onError: (err: any) => {
          setMatching(false);
          if (err?.status === 409) {
            setNotEnoughCount((err?.data as any)?.count ?? 0);
          } else {
            setError("Something went wrong. Please try again.");
          }
        },
      },
    );
  };

  const styles = makeStyles(colors, insets);
  const liveCount = poolCount ?? 0;
  const enoughPlayers = liveCount >= 5;

  if (!user) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (matching) {
    return (
      <View style={styles.container}>
        <Animated.View entering={FadeIn} style={styles.inner}>
          <Text style={styles.matchingTitle}>MATCHING...</Text>
          <Text style={styles.matchingSubtitle}>
            {filledSlots.length === 0
              ? "Ranking your perfect matches..."
              : `Connecting suitors (${filledSlots.length} / 5)...`}
          </Text>

          <View style={styles.slotsRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <SlotBox key={s} slot={s} filled={filledSlots.find((f) => f.slot === s)} />
            ))}
          </View>

          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
            {filledSlots.length >= 5 ? "ALL MATCHED — ENTERING ROOM..." : "WAITING FOR CONFIRMATIONS..."}
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.inner}>
        <Text style={styles.logo}>INTERMINGLED</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Ready to choose, <Text style={{ color: colors.primary }}>{user.name}</Text>?
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>FIND YOUR 5 MATCHES</Text>
          <Text style={styles.cardDesc}>
            We rank all live suitors by personality compatibility and instantly connect you with your top 5.
          </Text>

          {/* Live count */}
          <View style={[
            styles.countBox,
            { borderColor: enoughPlayers ? `${colors.secondary}50` : colors.border }
          ]}>
            <Text style={[styles.countNum, {
              color: poolCount === null ? colors.mutedForeground : enoughPlayers ? colors.secondary : colors.foreground,
            }]}>
              {poolCount === null ? "—" : liveCount}
            </Text>
            <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
              SUITOR{liveCount !== 1 ? "S" : ""} IN POOL RIGHT NOW
            </Text>
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i < liveCount ? colors.secondary : colors.border },
                  ]}
                />
              ))}
            </View>
            {enoughPlayers && (
              <Text style={[styles.readyText, { color: colors.secondary }]}>READY TO MATCH</Text>
            )}
          </View>

          {!isConnected && (
            <Text style={[styles.connText, { color: colors.mutedForeground }]}>
              Connecting to server...
            </Text>
          )}

          {notEnoughCount !== null && !enoughPlayers && (
            <View style={[styles.alertBox, { borderColor: `${colors.destructive}40`, backgroundColor: `${colors.destructive}10` }]}>
              <Text style={[styles.alertTitle, { color: colors.destructive }]}>NOT ENOUGH SUITORS YET</Text>
              <Text style={[styles.alertDesc, { color: colors.mutedForeground }]}>
                {liveCount} live suitor{liveCount !== 1 ? "s" : ""} in pool — need 5. Count updates live.
              </Text>
            </View>
          )}

          {error && (
            <View style={[styles.alertBox, { borderColor: `${colors.destructive}40`, backgroundColor: `${colors.destructive}10` }]}>
              <Text style={[styles.alertDesc, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.findBtn,
              { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
              pressed && { opacity: 0.8 },
              (!user || !isConnected || matchRoom.isPending) && { opacity: 0.5 },
            ]}
            onPress={handleFindMatches}
            disabled={!user || !isConnected || matchRoom.isPending}
          >
            <Text style={[styles.findBtnText, { color: colors.primary }]}>
              {matchRoom.isPending ? "MATCHING..." : notEnoughCount !== null ? "TRY AGAIN" : "FIND MY MATCHES"}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.mutedForeground }]}>← Back</Text>
        </Pressable>
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
      maxWidth: 380,
      paddingHorizontal: 20,
      alignItems: "center",
    },
    logo: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 4,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      marginBottom: 24,
    },
    card: {
      width: "100%",
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
      borderRadius: 12,
      padding: 20,
      backgroundColor: `${colors.card}`,
      gap: 14,
    },
    cardTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      letterSpacing: 1,
    },
    cardDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    countBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 16,
      alignItems: "center",
      gap: 4,
    },
    countNum: {
      fontSize: 40,
      fontFamily: "Inter_700Bold",
    },
    countLabel: {
      fontSize: 10,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1.5,
    },
    dotsRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    readyText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.5,
      marginTop: 4,
    },
    connText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    alertBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      gap: 4,
    },
    alertTitle: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.5,
    },
    alertDesc: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      lineHeight: 17,
    },
    findBtn: {
      borderWidth: 2,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: "center",
    },
    findBtnText: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      letterSpacing: 2,
    },
    matchingTitle: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 3,
      marginBottom: 8,
    },
    matchingSubtitle: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 32,
    },
    slotsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 24,
    },
    statusText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 1.5,
    },
    backBtn: {
      marginTop: 20,
      paddingVertical: 8,
    },
    backText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
  });
}
