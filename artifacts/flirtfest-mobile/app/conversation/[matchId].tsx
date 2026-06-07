import { useAuth, useUser } from "@clerk/expo";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { io as socketIO } from "socket.io-client";

interface DM {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

interface MatchInfo {
  id: string;
  otherName: string;
  otherPhotos: string[];
  otherUserId: string;
}

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const WS = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:8080";

export default function ConversationScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const insets = useSafeAreaInsets();

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  useEffect(() => {
    if (!isLoaded || !clerkUser || !matchId) return;

    // Load my profile
    authFetch(`${API}/profile/me`).then((r) => r.json()).then((me) => setMyUserId(me.id));

    // Load match info
    authFetch(`${API}/matches`).then((r) => r.json()).then((data) => {
      const match = (data.matches ?? []).find((m: MatchInfo) => m.id === matchId);
      if (match) setMatchInfo(match);
    });

    // Load messages
    authFetch(`${API}/matches/${matchId}/messages`).then((r) => r.json()).then((data) => {
      setMessages(data.messages ?? []);
    }).finally(() => setLoading(false));

    // Real-time socket
    const socket = socketIO(WS, { path: "/ws/socket.io", transports: ["websocket"] });
    socketRef.current = socket;
    socket.emit("join_match", { matchId });
    socket.on("dm_received", (msg: DM) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    return () => { socket.disconnect(); };
  }, [isLoaded, clerkUser, matchId]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const res = await authFetch(`${API}/matches/${matchId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setContent("");
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } finally {
      setSending(false);
    }
  };

  if (!isLoaded || loading) {
    return <View style={styles.center}><ActivityIndicator color="#8b5cf6" size="large" /></View>;
  }

  const otherPhoto = matchInfo?.otherPhotos?.[0];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.push("/(tabs)/inbox")}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerAvatar}>
          {otherPhoto ? (
            <Image source={{ uri: `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${otherPhoto}` }} style={styles.headerAvatarImg} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarLetter}>{matchInfo?.otherName?.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName}>{matchInfo?.otherName ?? "Match"}</Text>
          <Text style={styles.headerSub}>Matched ✓</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 8, flexGrow: 1, justifyContent: messages.length === 0 ? "center" : "flex-start" }}
        onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={() => (
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatEmoji}>💜</Text>
            <Text style={styles.emptyChatText}>You matched with {matchInfo?.otherName}! Say hello.</Text>
          </View>
        )}
        renderItem={({ item: msg }) => {
          const isMe = msg.senderId === myUserId;
          return (
            <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>{msg.content}</Text>
                <Text style={[styles.bubbleTime, isMe ? styles.bubbleTimeMe : styles.bubbleTimeThem]}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="Say something..."
          placeholderTextColor="#7d8899"
          maxLength={1000}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          style={[styles.sendBtn, (!content.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!content.trim() || sending}
        >
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  center: { flex: 1, backgroundColor: "#0b0d12", alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1e2230" },
  backBtn: { padding: 6 },
  backText: { fontSize: 22, color: "#f0f1f5" },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  headerAvatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  headerAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1a1e2e", alignItems: "center", justifyContent: "center" },
  headerAvatarLetter: { fontSize: 15, fontWeight: "800", color: "#8b5cf6" },
  headerName: { fontSize: 15, fontWeight: "700", color: "#f0f1f5" },
  headerSub: { fontSize: 11, color: "#2bbfa8" },
  emptyChat: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyChatEmoji: { fontSize: 40 },
  emptyChatText: { fontSize: 14, color: "#7d8899", textAlign: "center", lineHeight: 20 },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 2 },
  bubbleMe: { backgroundColor: "#8b5cf6", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#181b24", borderWidth: 1, borderColor: "#1e2230", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTextMe: { color: "#fff" },
  bubbleTextThem: { color: "#f0f1f5" },
  bubbleTime: { fontSize: 10, marginTop: 3 },
  bubbleTimeMe: { color: "rgba(255,255,255,0.5)", textAlign: "right" },
  bubbleTimeThem: { color: "#7d8899" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1e2230", backgroundColor: "#0b0d12" },
  input: { flex: 1, backgroundColor: "#181b24", borderWidth: 1, borderColor: "#1e2230", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#f0f1f5", fontSize: 15, minHeight: 44 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#8b5cf6", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon: { fontSize: 20, color: "#fff", fontWeight: "800" },
});
