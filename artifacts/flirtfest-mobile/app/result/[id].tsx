import { useGetRoom, getGetRoomQueryKey } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useColors } from "@/hooks/useColors";

export default function ResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { getParticipantId } = useApp();
  const [participantId, setParticipantId] = useState<string | null>(null);

  useEffect(() => {
    if (roomId) getParticipantId(roomId).then(setParticipantId);
  }, [roomId, getParticipantId]);

  const { data: room, isLoading } = useGetRoom(roomId ?? "", {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId ?? "") },
  });

  useEffect(() => {
    if (room && participantId) {
      const isWinner = room.winnerId === participantId;
      const isChooser = room.participants.find((p) => p.id === participantId)?.role === "chooser";
      if (isWinner || isChooser) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [room?.id, participantId]);

  const styles = makeStyles(colors, insets);

  if (isLoading || !room || !participantId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loading}>COMPILING RESULTS...</Text>
      </View>
    );
  }

  const isWinner = room.winnerId === participantId;
  const isChooser = room.participants.find((p) => p.id === participantId)?.role === "chooser";

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn} style={styles.card}>
        <Text style={styles.eyebrow}>MATCH RESULT</Text>

        <Animated.Text
          entering={ZoomIn.delay(200)}
          style={[
            styles.headline,
            { color: isWinner ? colors.primary : isChooser ? colors.secondary : colors.mutedForeground },
          ]}
        >
          {isWinner ? "YOU WON" : isChooser ? "MATCH CONFIRMED" : "GAME OVER"}
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(400)}>
          <Text style={styles.resultText}>
            {isWinner ? (
              <>
                <Text style={{ color: colors.secondary }}>{room.chooserName}</Text> chose you!
              </>
            ) : isChooser ? (
              <>
                You selected{" "}
                <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold" }}>
                  {room.winnerName}
                </Text>!
              </>
            ) : (
              <>
                {room.chooserName} chose{" "}
                <Text style={{ color: colors.secondary, fontFamily: "Inter_700Bold" }}>
                  {room.winnerName}
                </Text>.
              </>
            )}
          </Text>
        </Animated.View>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [styles.playAgainBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.playAgainText, { color: colors.foreground }]}>PLAY AGAIN</Text>
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
      paddingHorizontal: 24,
      paddingTop: isWeb ? 67 : insets.top,
      paddingBottom: isWeb ? 34 : insets.bottom,
    },
    loading: {
      marginTop: 16,
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 2,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 32,
      backgroundColor: `${colors.card}`,
      alignItems: "center",
      gap: 20,
    },
    eyebrow: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 3,
    },
    headline: {
      fontSize: 42,
      fontFamily: "Inter_700Bold",
      letterSpacing: 2,
      textAlign: "center",
    },
    resultText: {
      fontSize: 18,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      textAlign: "center",
      lineHeight: 26,
    },
    playAgainBtn: {
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 32,
      marginTop: 8,
    },
    playAgainText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      letterSpacing: 3,
    },
  });
}
