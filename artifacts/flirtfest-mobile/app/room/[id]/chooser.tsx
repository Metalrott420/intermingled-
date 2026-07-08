import {
  useGetRoom,
  useGetRoomMessages,
  useChooseWinner,
  getGetRoomQueryKey,
  getGetRoomMessagesQueryKey,
  Message,
  Room,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useRoomSocket } from "@/hooks/useSocket";
import { useColors } from "@/hooks/useColors";

const ROUND_LABELS: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "FINAL" };
type Phase = "messaging" | "eliminate" | "advancing" | "choose_winner";

function MessageBubble({ msg, isMe, colors }: { msg: Message; isMe: boolean; colors: any }) {
  return (
    <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "78%", marginBottom: 6 }}>
      <View style={{
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: isMe ? `${colors.primary}25` : `${colors.secondary}20`,
        borderWidth: 1,
        borderColor: isMe ? `${colors.primary}50` : `${colors.secondary}40`,
      }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 20 }}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "localhost"}`;

export default function ChooserRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user, getParticipantId } = useApp();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const chooseWinner = useChooseWinner();
  const [socketToken, setSocketToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then((t) => setSocketToken(t)).catch(() => {});
  }, [getToken]);

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState(1);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<Phase>("messaging");
  const [isProcessing, setIsProcessing] = useState(false);
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

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const currentRound = room?.currentRound ?? 1;
  const eliminatedParticipants = (room?.eliminatedParticipants ?? []) as string[];
  const questionsPerRound = currentRound <= 3 ? 1 : 3;
  const suitorSlots = [1, 2, 3, 4, 5];

  const isEliminated = useCallback((suitorId: string) =>
    eliminatedParticipants.includes(suitorId), [eliminatedParticipants]);

  const activeSlots = suitorSlots.filter((slot) => {
    const suitor = room?.participants.find((p) => p.suitorSlot === slot);
    return suitor && !isEliminated(suitor.id);
  });

  const questionsAskedInRound = useCallback((slot: number) =>
    messages.filter((m) => m.senderRole === "chooser" && m.suitorSlot === slot && m.round === currentRound).length,
    [messages, currentRound]);

  const allQuestionsAsked = activeSlots.length > 0 && activeSlots.every((slot) => questionsAskedInRound(slot) >= questionsPerRound);

  useEffect(() => {
    if (!allQuestionsAsked || phase !== "messaging") return;
    setPhase(currentRound < 4 ? "eliminate" : "choose_winner");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [allQuestionsAsked, currentRound, phase]);

  useEffect(() => {
    setPhase("messaging");
  }, [currentRound]);

  // ── Socket callbacks ─────────────────────────────────────────────────────────
  const onMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
    if (msg.senderRole === "suitor" && msg.suitorSlot != null) {
      setActiveTab((cur) => {
        const slot = msg.suitorSlot as number;
        if (slot !== cur) {
          setUnread((prev) => ({ ...prev, [slot]: (prev[slot] ?? 0) + 1 }));
        }
        return cur;
      });
    }
  }, []);

  const onRoomUpdated = useCallback((updatedRoom: Room) => {
    queryClient.setQueryData(getGetRoomQueryKey(roomId ?? ""), updatedRoom);
  }, [queryClient, roomId]);

  const onSessionEnded = useCallback(() => {
    router.replace(`/result/${roomId}`);
  }, [roomId]);

  const chooserName = room?.participants.find((p) => p.id === participantId)?.name ?? user?.name;

  const { isConnected, sendMessage } = useRoomSocket({
    roomId: roomId ?? undefined,
    participantId: participantId ?? undefined,
    senderName: chooserName,
    senderRole: "chooser",
    token: socketToken ?? undefined,
    onMessage,
    onRoomUpdated,
    onSessionEnded,
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const content = inputs[activeTab];
    if (!content?.trim() || phase !== "messaging") return;
    if (questionsAskedInRound(activeTab) >= questionsPerRound) return;
    sendMessage(content, activeTab, currentRound);
    setInputs((prev) => ({ ...prev, [activeTab]: "" }));
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTabChange = (slot: number) => {
    setActiveTab(slot);
    setUnread((prev) => ({ ...prev, [slot]: 0 }));
    Haptics.selectionAsync();
  };

  const handleEliminate = async (pId: string) => {
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const t = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (t) headers["Authorization"] = `Bearer ${t}`;
      await fetch(`${BASE_URL}/api/rooms/${roomId}/eliminate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ participantId: pId }),
      });
      setPhase("advancing");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvanceRound = async () => {
    setIsProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const t = await getToken();
      const headers: Record<string, string> = {};
      if (t) headers["Authorization"] = `Bearer ${t}`;
      await fetch(`${BASE_URL}/api/rooms/${roomId}/advance-round`, { method: "POST", headers });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChoose = async (winnerId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    chooseWinner.mutate({ id: roomId ?? "", data: { winnerId } });
  };

  const styles = makeStyles(colors, insets);
  const isActive = room?.status === "active";
  const tabSuitor = room?.participants.find((p) => p.suitorSlot === activeTab);
  const slotMessages = messages.filter((m) => m.suitorSlot === activeTab);
  const tabEliminated = tabSuitor ? isEliminated(tabSuitor.id) : false;
  const tabAsked = questionsAskedInRound(activeTab);
  const tabQuotaMet = tabAsked >= questionsPerRound;
  const canSendToTab = !tabEliminated && !tabQuotaMet && phase === "messaging";

  if (!room || !participantId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>INTERMINGLED</Text>
          <Text style={styles.headerSub}>ROOM {room.code}</Text>
        </View>
        <View style={styles.headerRight}>
          {isActive && (
            <View style={{ alignItems: "center", marginRight: 10 }}>
              <Text style={[styles.roundValue, { color: currentRound === 4 ? colors.primary : colors.secondary }]}>
                {ROUND_LABELS[currentRound] ?? currentRound}
              </Text>
              <Text style={styles.roundLabel}>ROUND</Text>
            </View>
          )}
          <View style={[styles.connDot, { backgroundColor: isConnected ? colors.secondary : colors.mutedForeground }]} />
          <Text style={[styles.headerStatus, { color: isActive ? colors.secondary : colors.mutedForeground }]}>
            {isActive ? "LIVE" : "WAIT"}
          </Text>
        </View>
      </View>

      {/* Phase banner */}
      {isActive && phase === "eliminate" && (
        <View style={[styles.phaseBanner, { backgroundColor: "#ef444415", borderBottomColor: "#ef444440" }]}>
          <Text style={[styles.phaseBannerText, { color: "#ef4444" }]}>
            ✂  ELIMINATE A SUITOR
          </Text>
        </View>
      )}
      {isActive && phase === "advancing" && (
        <View style={[styles.phaseBannerRow, { backgroundColor: "#f9731615", borderBottomColor: "#f9731640" }]}>
          <Text style={[styles.phaseBannerText, { color: "#f97316" }]}>
            Suitor eliminated
          </Text>
          <Pressable
            onPress={handleAdvanceRound}
            disabled={isProcessing}
            style={({ pressed }) => [
              styles.advanceBtn,
              { backgroundColor: "#f97316", opacity: pressed || isProcessing ? 0.7 : 1 },
            ]}
          >
            <Text style={styles.advanceBtnText}>
              START R{ROUND_LABELS[currentRound + 1] ?? currentRound + 1} →
            </Text>
          </Pressable>
        </View>
      )}
      {isActive && phase === "choose_winner" && (
        <View style={[styles.phaseBanner, { backgroundColor: `${colors.primary}15`, borderBottomColor: `${colors.primary}40` }]}>
          <Text style={[styles.phaseBannerText, { color: colors.primary }]}>
            ✨  CHOOSE YOUR MATCH
          </Text>
        </View>
      )}

      {!isActive ? (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingTitle}>Waiting for challengers</Text>
          <View style={styles.slotsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.slotBox,
                  i <= room.suitorCount
                    ? { borderColor: colors.secondary, backgroundColor: `${colors.secondary}20` }
                    : { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.slotBoxText, { color: i <= room.suitorCount ? colors.secondary : colors.mutedForeground }]}>
                  {i <= room.suitorCount ? "✓" : String(i)}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.waitingCount}>{room.suitorCount} / 5 suitors joined</Text>
        </View>
      ) : (
        <>
          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            <View style={styles.tabs}>
              {suitorSlots.map((slot) => {
                const s = room.participants.find((p) => p.suitorSlot === slot);
                if (!s) return null;
                const elim = isEliminated(s.id);
                const count = unread[slot] ?? 0;
                const asked = questionsAskedInRound(slot);
                const done = asked >= questionsPerRound;
                const isActive_ = activeTab === slot;
                return (
                  <Pressable
                    key={slot}
                    onPress={() => handleTabChange(slot)}
                    style={[
                      styles.tab,
                      isActive_ && !elim && { borderBottomWidth: 2, borderBottomColor: colors.secondary },
                      elim && { opacity: 0.35 },
                    ]}
                  >
                    <Text style={[
                      styles.tabText,
                      { color: elim ? colors.mutedForeground : isActive_ ? colors.secondary : colors.mutedForeground },
                      elim && { textDecorationLine: "line-through" },
                    ]}>
                      {s.name.slice(0, 5)}
                    </Text>
                    {!elim && done && (
                      <View style={[styles.doneDot, { backgroundColor: colors.secondary }]} />
                    )}
                    {!elim && !done && count > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Suitor bar */}
          {tabSuitor && !tabEliminated && (
            <View style={[styles.suitorBar, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.suitorName, { color: colors.secondary }]}>{tabSuitor.name}</Text>
              </View>
              <Text style={[styles.questionCounter, {
                color: tabQuotaMet ? colors.secondary : colors.mutedForeground,
                borderColor: tabQuotaMet ? `${colors.secondary}50` : colors.border,
                backgroundColor: tabQuotaMet ? `${colors.secondary}15` : "transparent",
              }]}>
                {tabAsked}/{questionsPerRound}
              </Text>
            </View>
          )}

          {/* Messages */}
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
            <FlatList
              data={[...slotMessages].reverse()}
              keyExtractor={(m) => m.id}
              inverted
              contentContainerStyle={styles.messagesList}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <MessageBubble
                  msg={item}
                  isMe={item.senderRole === "chooser"}
                  colors={colors}
                />
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {tabEliminated ? `${tabSuitor?.name ?? "Suitor"} was eliminated` : `Ask ${tabSuitor?.name ?? "them"} a question...`}
                </Text>
              }
            />

            {/* Bottom action area */}
            {tabSuitor && !tabEliminated && (
              <View style={[styles.actionArea, { paddingBottom: insets.bottom + 8 }]}>
                {phase === "messaging" && (
                  <View style={styles.inputRow}>
                    <TextInput
                      ref={inputRef}
                      style={styles.input}
                      placeholder={canSendToTab ? `Ask ${tabSuitor.name}...` : "Question asked ✓"}
                      placeholderTextColor={colors.mutedForeground}
                      value={inputs[activeTab] ?? ""}
                      onChangeText={(t) => setInputs((prev) => ({ ...prev, [activeTab]: t }))}
                      onSubmitEditing={handleSend}
                      returnKeyType="send"
                      blurOnSubmit={false}
                      editable={canSendToTab}
                    />
                    <Pressable
                      onPress={handleSend}
                      disabled={!canSendToTab}
                      style={({ pressed }) => [
                        styles.sendBtn,
                        { backgroundColor: colors.secondary, opacity: canSendToTab ? (pressed ? 0.8 : 1) : 0.3 },
                      ]}
                    >
                      <Text style={[styles.sendBtnText, { color: colors.secondaryForeground }]}>↑</Text>
                    </Pressable>
                  </View>
                )}

                {phase === "eliminate" && (
                  <Pressable
                    onPress={() => handleEliminate(tabSuitor.id)}
                    disabled={isProcessing}
                    style={({ pressed }) => [
                      styles.eliminateBtn,
                      { backgroundColor: "#ef444420", borderColor: "#ef444450", opacity: pressed || isProcessing ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.eliminateBtnText, { color: "#ef4444" }]}>
                      ✕  ELIMINATE {tabSuitor.name.toUpperCase()}
                    </Text>
                  </Pressable>
                )}

                {phase === "advancing" && (
                  <View style={[styles.eliminateBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.eliminateBtnText, { color: colors.mutedForeground }]}>
                      ROUND ENDING...
                    </Text>
                  </View>
                )}

                {phase === "choose_winner" && (
                  <Pressable
                    onPress={() => handleChoose(tabSuitor.id)}
                    disabled={chooseWinner.isPending}
                    style={({ pressed }) => [
                      styles.chooseBtn,
                      { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}50`, opacity: pressed || chooseWinner.isPending ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={[styles.chooseBtnText, { color: colors.primary }]}>
                      ✨  CHOOSE {tabSuitor.name.toUpperCase()}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    header: {
      alignSelf: "stretch",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: `${colors.card}`,
    },
    headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.primary, letterSpacing: 3 },
    headerSub: { fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, letterSpacing: 1 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    connDot: { width: 6, height: 6, borderRadius: 3 },
    headerStatus: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2 },
    roundValue: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: 1 },
    roundLabel: { fontSize: 7, fontFamily: "Inter_400Regular", color: colors.mutedForeground, letterSpacing: 2, textTransform: "uppercase" },
    phaseBanner: {
      alignSelf: "stretch",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      alignItems: "center",
    },
    phaseBannerRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderBottomWidth: 1,
      alignItems: "center",
      justifyContent: "space-between",
    },
    phaseBannerText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
    advanceBtn: {
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    advanceBtnText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1.5 },
    tabsScroll: { alignSelf: "stretch", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: `${colors.card}80` },
    tabs: { flexDirection: "row" },
    tab: {
      minWidth: 64,
      paddingVertical: 10,
      paddingHorizontal: 8,
      alignItems: "center",
      position: "relative",
    },
    tabText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5, textTransform: "uppercase" },
    doneDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3 },
    badge: { position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    badgeText: { fontSize: 8, fontFamily: "Inter_700Bold", color: "#fff" },
    suitorBar: {
      alignSelf: "stretch",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    suitorName: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 1 },
    questionCounter: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      letterSpacing: 0.5,
    },
    messagesList: { padding: 16, flexGrow: 1 },
    emptyText: { textAlign: "center", fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 40 },
    actionArea: {
      alignSelf: "stretch",
      paddingHorizontal: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: `${colors.background}f0`,
    },
    inputRow: { flexDirection: "row", gap: 8 },
    input: {
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
    eliminateBtn: {
      height: 48,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    eliminateBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
    chooseBtn: {
      height: 48,
      borderWidth: 1,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    chooseBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
    waitingContainer: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 24 },
    waitingTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 1 },
    slotsRow: { flexDirection: "row", gap: 10 },
    slotBox: { width: 50, height: 50, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
    slotBoxText: { fontSize: 14, fontFamily: "Inter_700Bold" },
    waitingCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
  });
}
