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

function MessageBubble({ msg, isMe, colors }: { msg: Message; isMe: boolean; colors: any }) {
  return (
    <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "78%", marginBottom: 6 }}>
      <Text style={{
        fontSize: 10,
        fontFamily: "Inter_400Regular",
        color: colors.mutedForeground,
        marginBottom: 2,
        marginLeft: 4,
      }}>
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

  const { isConnected, sendMessage } = useRoomSocket({
    roomId: roomId ?? undefined,
    participantId: participantId ?? undefined,
    senderName: myParticipant?.name ?? user?.name,
    senderRole: "suitor",
    onMessage,
    onRoomUpdated,
    onSessionEnded,
  });

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input, myParticipant?.suitorSlot ?? null);
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={[styles.connDot, { backgroundColor: isConnected ? colors.secondary : colors.mutedForeground }]} />
          <Text style={[styles.statusText, { color: isActive ? colors.primary : colors.mutedForeground }]}>
            {isActive ? "LIVE" : "WAITING"}
          </Text>
        </View>
      </View>

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
              <Text style={styles.emptyText}>SAY SOMETHING TO STAND OUT</Text>
            }
          />
          <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Say something to stand out..."
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
    headerTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: colors.secondary,
      letterSpacing: 1,
    },
    headerSub: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    connDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 2,
    },
    waitContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    waitTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: 12,
    },
    waitSub: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    waitHint: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: `${colors.mutedForeground}80`,
    },
    messageList: { padding: 16, flexGrow: 1 },
    emptyText: {
      textAlign: "center",
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 2,
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
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  });
}
