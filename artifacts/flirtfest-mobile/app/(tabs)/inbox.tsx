import { useAuth, useUser } from "@clerk/expo";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MatchItem {
  id: string;
  otherName: string;
  otherPhotos: string[];
  otherUserId: string;
  createdAt: string;
  lastMessage: { content: string; createdAt: string; senderName: string } | null;
}

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function InboxScreen() {
  const { getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const token = await getToken();
    const res = await fetch(`${API}/matches`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    setMatches(data.matches ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [getToken]);

  useEffect(() => { if (isLoaded && clerkUser) load(); }, [isLoaded, clerkUser]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  if (!isLoaded || loading) {
    return <View style={styles.center}><ActivityIndicator color="#8b5cf6" size="large" /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Matches</Text>
        <Text style={styles.count}>{matches.length} match{matches.length !== 1 ? "es" : ""}</Text>
      </View>

      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>💜</Text>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptyBody}>When you're picked in a speed date, your match will appear here.</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.emptyBtnText}>Start Dating</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: match }) => {
            const photo = match.otherPhotos?.[0];
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/conversation/${match.id}`)}>
                <View style={styles.avatarWrap}>
                  {photo ? (
                    <Image
                      source={{ uri: `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${photo}` }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarLetter}>{match.otherName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.onlineDot} />
                </View>
                <View style={styles.info}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name}>{match.otherName}</Text>
                    {match.lastMessage && (
                      <Text style={styles.time}>{timeAgo(match.lastMessage.createdAt)}</Text>
                    )}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>
                    {match.lastMessage
                      ? `${match.lastMessage.senderName}: ${match.lastMessage.content}`
                      : "💜 You matched! Say hello."}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  center: { flex: 1, backgroundColor: "#0b0d12", alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e2230" },
  title: { fontSize: 20, fontWeight: "800", color: "#f0f1f5" },
  count: { fontSize: 12, color: "#7d8899", fontFamily: "Inter_400Regular" },
  separator: { height: 1, backgroundColor: "#1e2230" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26, resizeMode: "cover" },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#1a1e2e", alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 20, fontWeight: "800", color: "#8b5cf6" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#2bbfa8", borderWidth: 2, borderColor: "#0b0d12" },
  info: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  name: { fontSize: 15, fontWeight: "700", color: "#f0f1f5" },
  time: { fontSize: 11, color: "#7d8899" },
  preview: { fontSize: 13, color: "#7d8899" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#f0f1f5" },
  emptyBody: { fontSize: 14, color: "#7d8899", textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8, backgroundColor: "#8b5cf6", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
