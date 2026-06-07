import {
  useGetRoom,
  useGetRoomMessages,
  getGetRoomQueryKey,
  getGetRoomMessagesQueryKey,
  Message,
  Room,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useRoomSocket } from "@/hooks/useSocket";
import { useColors } from "@/hooks/useColors";

const ROUND_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "FINAL" };

function MessageBubble({ msg, isMe, colors }: { msg: Message; isMe: boolean; colors: any }) {
  return (
    <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "78%", marginBottom: 6 }}>
      <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2, marginLeft: 4 }}>
        {isMe ? "YOU" : msg.senderName}
      </Text>
      <View style={{
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: isMe ? `${colors.secondary}20` : `${colors.primary}20`,
        borderWidth: 1,
        borderColor: isMe ? `${colors.secondary}50` : `${colors.primary}40`,
      }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 }}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

export default function SuitorRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user, getParticipantId } = useApp();
  const queryClient = useQueryClient();

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isEliminated, setIsEliminated] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (roomId) getParticipantId(roomId).then(setParticipantId);
  }, [roomId, getParticipantId]);

  const { data: room } = useGetRoom(roomId ?? "", {
    query: { enabled: !!roomId, queryKey: getGetRoomQueryKey(roomId ?? "") },
  });
  const { data: initialMessages } = useGetRoomMessages(roomId ?? "", {
    query: { enabled: !!roomId, queryKey: getGetRoomMessagesQueryKey(roomId ?? "") },
  });

  const myParticipant = room?.participants.find((p) => p.id === participantId);
  const currentRound = room?.currentRound ?? 1;

  useEffect(() => {
    if (initialMessages && myParticipant) {
      setMessages(initialMessages.filter((m) => m.suitorSlot === myParticipant.suitorSlot));
    }
  }, [initialMessages, myParticipant?.suitorSlot]);

  const onMessage = useCallback((msg: Message) => {
    if (myParticipant && msg.suitorSlot === myParticipant.suitorSlot) {
      setMessages((prev) => [...prev, msg]);
    }
  }, [myParticipant?.suitorSlot]);

  const onRoomUpdated = useCallback((updatedRoom: Room) => {
    queryClient.setQueryData(getGetRoomQueryKey(roomId ?? ""), updatedRoom);
  }, [queryClient, roomId]);

  const onSessionEnded = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.replace(`/result/${roomId}`);
  }, [roomId]);

  const onSuitorEliminated = useCallback(({ participantId: eliminatedId }: { participantId: string }) => {
    if (eliminatedId === participantId) {
      setIsEliminated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [participantId]);

  const { isConnected, sendMessage } = useRoomSocket({
    roomId: roomId ?? undefined,
    participantId: participantId ?? undefined,
    senderName: myParticipant?.name ?? user?.name,
    senderRole: "suitor",
    onMessage,
    onRoomUpdated,
    onSessionEnded,
    onSuitorEliminated,
  });

  const handleSend = () => {
    if (!input.trim() || isEliminated) return;
    sendMessage(input, myParticipant?.suitorSlot ?? null, currentRound);
    setInput("");
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const styles = makeStyles(colors, insets);
  const isActive = room?.status === "active";

  if (!room || !participantId) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.secondary} />
      </View>
    );
  }

  // ── Elimination screen ─────────────────────────────────────────────────────
  if (isEliminated) {
    const hasPool = !!user?.userId;
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <View style={[styles.eliminatedCard, { borderColor: `${colors.destructive ?? "#ef4444"}30`, backgroundColor: colors.card }]}>
          <Text style={[styles.eliminatedX, { color: `${colors.destructive ?? "#ef4444"}30` }]}>✕</Text>
          <Text style={[styles.eliminatedTitle, { color: colors.destructive ?? "#ef4444" }]}>ELIMINATED</Text>
          <Text style={[styles.eliminatedSub, { color: colors.mutedForeground }]}>
            {room.chooserName} has made their choice. You were cut after Round {ROUND_LABELS[currentRound] ?? currentRound}.
          </Text>
          <Text style={[styles.eliminatedHint, { color: `${colors.mutedForeground}60` }]}>
            Shake it off — the pool awaits
          </Text>

          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            {hasPool && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.replace("/pool");
                }}
                style={({ pressed }) => [
                  styles.rejoinBtn,
                  { backgroundColor: `${colors.secondary}20`, borderColor: `${colors.secondary}50` },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.rejoinBtnText, { color: colors.secondary }]}>↩ Rejoin Pool</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.replace("/");
              }}
              style={({ pressed }) => [
                styles.playAgainBtn,
                { borderColor: colors.border, backgroundColor: pressed ? colors.muted : colors.card },
              ]}
            >
              <Text style={[styles.playAgainText, { color: colors.foreground }]}>
                {hasPool ? "Start Fresh" : "Play Again"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8) }]}>
        <View>
          <Text style={styles.headerTitle}>{room.chooserName ?? "Chooser"}'s Room</Text>
          {myParticipant && (
            <Text style={styles.headerSub}>
              YOU: <Text style={{ color: colors.secondary }}>{myParticipant.name.toUpperCase()}</Text>
              {myParticipant.suitorSlot != null ? ` · SLOT ${myParticipant.suitorSlot}` : ""}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {isActive && (
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.roundValue, { color: currentRound === 4 ? colors.primary : colors.secondary }]}>
                {ROUND_LABELS[currentRound] ?? currentRound}
              </Text>
              <Text style={styles.roundLabel}>ROUND</Text>
            </View>
          )}
          <View style={[styles.connDot, { backgroundColor: isConnected ? colors.secondary : colors.mutedForeground }]} />
          <Text style={[styles.statusText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
            {isActive ? "LIVE" : "WAITING"}
          </Text>
        </View>
      </View>

      {/* Round info strip */}
      {isActive && (
        <View style={[styles.roundStrip, { borderBottomColor: colors.border }]}>
          <Text style={[styles.roundStripText, { color: colors.mutedForeground }]}>
            Round {ROUND_LABELS[currentRound] ?? currentRound} — {currentRound <= 3 ? `${6 - currentRound} suitors remain` : "Finals: make your case!"}
          </Text>
        </View>
      )}

      {!isActive ? (
        <View style={styles.waitContainer}>
          <ActivityIndicator color={colors.secondary} size="large" />
          <Text style={styles.waitTitle}>Waiting to start</Text>
          <Text style={styles.waitSub}>{room.suitorCount} / 5 suitors joined</Text>
          <Text style={styles.waitHint}>Session starts when all 5 slots fill</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
          <FlatList
            data={[...messages].reverse()}
            keyExtractor={(m) => m.id}
            inverted
            contentContainerStyle={styles.messageList}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <MessageBubble msg={item} isMe={item.senderId === participantId} colors={colors} />
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>WAITING FOR {room.chooserName?.toUpperCase()}'S QUESTION...</Text>
            }
          />
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Your answer..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              blurOnSubmit={false}
              autoFocus
            />
            <Pressable
              onPress={handleSend}
              style={({ pressed }) => [
                styles.sendBtn,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.sendBtnText, { color: colors.secondaryForeground }]}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: `${colors.secondary}30`,
      backgroundColor: `${colors.secondary}08`,
    },
    headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.secondary, letterSpacing: 1 },
    headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    roundValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
    roundLabel: { fontSize: 7, fontFamily: "Inter_400Regular", color: colors.mutedForeground, letterSpacing: 2, textTransform: "uppercase" },
    connDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2 },
    roundStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderBottomWidth: 1,
      backgroundColor: `${colors.secondary}05`,
    },
    roundStripText: { fontSize: 11, fontFamily: "Inter_400Regular" },
    waitContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    waitTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, marginTop: 12 },
    waitSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    waitHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: `${colors.mutedForeground}80` },
    messageList: { padding: 16, flexGrow: 1 },
    emptyText: { textAlign: "center", fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 1, marginTop: 40 },
    inputRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingTop: 8,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: `${colors.background}f0`,
    },
    textInput: {
      flex: 1,
      height: 44,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    sendBtn: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    sendBtnText: { fontSize: 20, fontFamily: "Inter_700Bold" },
    eliminatedCard: {
      width: "100%",
      maxWidth: 360,
      borderWidth: 1,
      borderRadius: 16,
      padding: 32,
      alignItems: "center",
      gap: 12,
    },
    eliminatedX: { fontSize: 56, fontFamily: "Inter_700Bold" },
    eliminatedTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
    eliminatedSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
    eliminatedHint: { fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 2, textTransform: "uppercase" },
    rejoinBtn: {
      width: "100%",
      height: 50,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    rejoinBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
    playAgainBtn: {
      width: "100%",
      height: 46,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    playAgainText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1.5, textTransform: "uppercase" },
  });
}
