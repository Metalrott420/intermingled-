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
import { useQueryClient } from "@tanstack/react-query";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import { useRoomSocket } from "@/hooks/useSocket";
import { useColors } from "@/hooks/useColors";

interface FilledSlot { slot: number; suitorName: string; }

function MessageBubble({ msg, isMe, colors }: { msg: Message; isMe: boolean; colors: any }) {
  return (
    <View style={{
      alignSelf: isMe ? "flex-end" : "flex-start",
      maxWidth: "78%",
      marginBottom: 6,
    }}>
      <View style={{
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: isMe ? `${colors.primary}25` : `${colors.secondary}20`,
        borderWidth: 1,
        borderColor: isMe ? `${colors.primary}50` : `${colors.secondary}40`,
      }}>
        <Text style={{
          fontSize: 14,
          fontFamily: "Inter_400Regular",
          color: colors.foreground,
          lineHeight: 20,
        }}>{msg.content}</Text>
      </View>
    </View>
  );
}

export default function ChooserRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user, getParticipantId } = useApp();
  const queryClient = useQueryClient();
  const chooseWinner = useChooseWinner();

  const [participantId, setParticipantId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState(1);
  const [unread, setUnread] = useState<Record<number, number>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
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
    onMessage,
    onRoomUpdated,
    onSessionEnded,
  });

  const handleSend = () => {
    const content = inputs[activeTab];
    if (!content?.trim()) return;
    sendMessage(content, activeTab);
    setInputs((prev) => ({ ...prev, [activeTab]: "" }));
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleTabChange = (slot: number) => {
    setActiveTab(slot);
    setUnread((prev) => ({ ...prev, [slot]: 0 }));
    Haptics.selectionAsync();
  };

  const handleChoose = (winnerId: string, name: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    chooseWinner.mutate({ id: roomId ?? "", data: { winnerId } });
  };

  const styles = makeStyles(colors, insets);

  const isActive = room?.status === "active";
  const suitorSlots = [1, 2, 3, 4, 5];
  const tabSuitor = room?.participants.find((p) => p.suitorSlot === activeTab);
  const slotMessages = messages.filter((m) => m.suitorSlot === activeTab);

  if (!room || !participantId) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>LOADING DATABANKS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.headerTitle}>FLIRTFEST</Text>
          <Text style={styles.headerSub}>ROOM {room.code}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.connDot, { backgroundColor: isConnected ? colors.secondary : colors.mutedForeground }]} />
          <Text style={styles.headerStatus}>{isActive ? "LIVE" : "WAITING"}</Text>
        </View>
      </View>

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
          <View style={styles.tabs}>
            {suitorSlots.map((slot) => {
              const s = room.participants.find((p) => p.suitorSlot === slot);
              const count = unread[slot] ?? 0;
              return (
                <Pressable
                  key={slot}
                  onPress={() => handleTabChange(slot)}
                  style={[
                    styles.tab,
                    activeTab === slot && { borderBottomWidth: 2, borderBottomColor: colors.secondary },
                  ]}
                >
                  <Text style={[styles.tabText, { color: activeTab === slot ? colors.secondary : colors.mutedForeground }]}>
                    {s ? s.name.slice(0, 5) : `#${slot}`}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Suitor header */}
          {tabSuitor && (
            <View style={[styles.suitorBar, { borderBottomColor: colors.border }]}>
              <Text style={[styles.suitorName, { color: colors.secondary }]}>
                {tabSuitor.name}
              </Text>
              <Pressable
                onPress={() => handleChoose(tabSuitor.id, tabSuitor.name)}
                style={({ pressed }) => [
                  styles.chooseBtn,
                  { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
                  pressed && { opacity: 0.7 },
                ]}
                disabled={chooseWinner.isPending}
              >
                <Text style={[styles.chooseBtnText, { color: colors.primary }]}>
                  CHOOSE {tabSuitor.name.toUpperCase()}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Messages */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior="padding"
            keyboardVerticalOffset={0}
          >
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
                <Text style={styles.emptyText}>Say something to {tabSuitor?.name ?? "them"}...</Text>
              }
            />

            <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor={colors.mutedForeground}
                value={inputs[activeTab] ?? ""}
                onChangeText={(t) => setInputs((prev) => ({ ...prev, [activeTab]: t }))}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                blurOnSubmit={false}
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
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, insets: ReturnType<typeof useSafeAreaInsets>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loading: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      letterSpacing: 2,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: `${colors.card}`,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: 3,
    },
    headerSub: {
      fontSize: 10,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      letterSpacing: 1,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    connDot: { width: 6, height: 6, borderRadius: 3 },
    headerStatus: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: colors.secondary,
      letterSpacing: 2,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: `${colors.card}80`,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      position: "relative",
    },
    tabText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      fontSize: 8,
      fontFamily: "Inter_700Bold",
      color: "#fff",
    },
    suitorBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
    },
    suitorName: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1,
    },
    chooseBtn: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chooseBtnText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.5,
    },
    messagesList: {
      padding: 16,
      flexGrow: 1,
    },
    emptyText: {
      textAlign: "center",
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 40,
    },
    inputRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingTop: 8,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: `${colors.background}f0`,
    },
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
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnText: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
    },
    waitingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
    },
    waitingTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.mutedForeground,
      letterSpacing: 1,
    },
    slotsRow: { flexDirection: "row", gap: 10 },
    slotBox: {
      width: 50,
      height: 50,
      borderRadius: 8,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    slotBoxText: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
    waitingCount: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });
}
