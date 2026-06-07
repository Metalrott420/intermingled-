import { useAuth, useUser } from "@clerk/expo";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  dateOfBirth: string | null;
  photos: string[];
  role: string | null;
}

const API = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export default function ProfileScreen() {
  const { getToken } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDob, setEditDob] = useState("");
  const [ageError, setAgeError] = useState<string | null>(null);

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  };

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    authFetch(`${API}/profile/me`)
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setEditName(data.name ?? "");
        setEditBio(data.bio ?? "");
        setEditDob(data.dateOfBirth ?? "");
      })
      .finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

  const handleSave = async () => {
    if (!profile) return;
    setAgeError(null);
    if (editDob) {
      const age = calculateAge(editDob);
      if (age < 18) { setAgeError("You must be 18 or older."); return; }
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API}/profile/me`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), bio: editBio.trim(), dateOfBirth: editDob || undefined }),
      });
      if (!res.ok) { const e = await res.json(); setAgeError(e.error); return; }
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const filename = asset.fileName ?? "photo.jpg";
      const type = asset.mimeType ?? "image/jpeg";
      const size = asset.fileSize ?? 500000;

      const urlRes = await authFetch(`${API}/profile/me/photos/upload-url`, {
        method: "POST",
        body: JSON.stringify({ name: filename, size, contentType: type }),
      });
      if (!urlRes.ok) { Alert.alert("Error", "Could not get upload URL"); return; }
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": type },
        body: { uri: asset.uri, type, name: filename } as any,
      });

      const addRes = await authFetch(`${API}/profile/me/photos`, {
        method: "POST",
        body: JSON.stringify({ objectPath }),
      });
      if (!addRes.ok) return;
      const { photos } = await addRes.json();
      setProfile((p) => p ? { ...p, photos } : p);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (objectPath: string) => {
    Alert.alert("Remove photo?", "This will permanently delete this photo.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const res = await authFetch(`${API}/profile/me/photos`, {
            method: "DELETE",
            body: JSON.stringify({ objectPath }),
          });
          if (!res.ok) return;
          const { photos } = await res.json();
          setProfile((p) => p ? { ...p, photos } : p);
        },
      },
    ]);
  };

  if (!isLoaded || loading) {
    return <View style={styles.center}><ActivityIndicator color="#8b5cf6" size="large" /></View>;
  }

  const photos = profile?.photos ?? [];
  const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
  const slots = Array.from({ length: 12 });

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        {!editing ? (
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => { setEditing(false); setAgeError(null); }} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </View>
        )}
      </View>

      {/* Cover photo */}
      <View style={styles.cover}>
        {photos[0] ? (
          <Image source={{ uri: `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${photos[0]}` }} style={styles.coverImg} />
        ) : (
          <View style={styles.coverPlaceholder} />
        )}
        <View style={styles.coverOverlay} />
        <Text style={styles.coverName}>
          {profile?.name}{age !== null ? `, ${age}` : ""}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Name */}
        <Text style={styles.label}>Name</Text>
        {editing ? (
          <TextInput style={styles.input} value={editName} onChangeText={setEditName} maxLength={80} placeholder="Your name" placeholderTextColor="#7d8899" />
        ) : (
          <Text style={styles.value}>{profile?.name || <Text style={styles.placeholder}>—</Text>}</Text>
        )}

        {/* DOB */}
        <Text style={[styles.label, { marginTop: 16 }]}>Date of Birth <Text style={{ color: "#ef4444" }}>*</Text></Text>
        {editing ? (
          <TextInput
            style={styles.input}
            value={editDob}
            onChangeText={(v) => { setEditDob(v); setAgeError(null); }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#7d8899"
            keyboardType="numeric"
          />
        ) : (
          <Text style={styles.value}>{profile?.dateOfBirth || <Text style={styles.placeholder}>Not set</Text>}</Text>
        )}
        {ageError && <Text style={styles.error}>{ageError}</Text>}
        <Text style={styles.hint}>Must be 18+ to use Intermingled</Text>

        {/* Bio */}
        <Text style={[styles.label, { marginTop: 16 }]}>About me</Text>
        {editing ? (
          <TextInput
            style={[styles.input, { height: 96, textAlignVertical: "top", paddingTop: 10 }]}
            value={editBio}
            onChangeText={setEditBio}
            maxLength={500}
            multiline
            placeholder="Tell matches about yourself..."
            placeholderTextColor="#7d8899"
          />
        ) : (
          <Text style={styles.value}>{profile?.bio || <Text style={styles.placeholder}>No bio yet</Text>}</Text>
        )}

        {/* Photos */}
        <Text style={[styles.label, { marginTop: 20 }]}>Photos ({photos.length}/12)</Text>
        <View style={styles.photoGrid}>
          {slots.map((_, i) => {
            const photo = photos[i];
            const isNext = i === photos.length;
            if (photo) {
              return (
                <Pressable key={i} style={styles.photoSlot} onLongPress={() => handleRemovePhoto(photo)}>
                  <Image source={{ uri: `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/storage${photo}` }} style={styles.photoImg} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={i}
                style={[styles.photoSlot, styles.photoEmpty, !isNext && { opacity: 0.3 }]}
                onPress={() => isNext && !uploading && handleAddPhoto()}
                disabled={!isNext || uploading}
              >
                {isNext && uploading ? (
                  <ActivityIndicator color="#8b5cf6" size="small" />
                ) : isNext ? (
                  <Text style={styles.photoPlus}>+</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Long-press a photo to remove it</Text>

        {/* Go to inbox */}
        <Pressable style={styles.inboxBtn} onPress={() => router.push("/(tabs)/inbox")}>
          <Text style={styles.inboxBtnText}>Messages & Matches →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0d12" },
  center: { flex: 1, backgroundColor: "#0b0d12", alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1e2230" },
  title: { fontSize: 20, fontWeight: "800", color: "#f0f1f5" },
  editBtn: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: "#8b5cf6", borderRadius: 8 },
  editBtnText: { color: "#8b5cf6", fontWeight: "600", fontSize: 13 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#1e2230", borderRadius: 8 },
  cancelBtnText: { color: "#7d8899", fontWeight: "600", fontSize: 13 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#8b5cf6", borderRadius: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cover: { height: 220, backgroundColor: "#181b24", position: "relative" },
  coverImg: { width: "100%", height: "100%", resizeMode: "cover" },
  coverPlaceholder: { flex: 1, backgroundColor: "#1a1e2e" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  coverName: { position: "absolute", bottom: 16, left: 16, fontSize: 26, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  body: { padding: 16 },
  label: { fontSize: 11, color: "#7d8899", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  value: { fontSize: 15, color: "#f0f1f5", lineHeight: 22 },
  placeholder: { color: "#4a5060", fontStyle: "italic" },
  input: { backgroundColor: "#181b24", borderWidth: 1, borderColor: "#1e2230", borderRadius: 8, height: 44, paddingHorizontal: 14, color: "#f0f1f5", fontSize: 15 },
  error: { color: "#ef4444", fontSize: 12, marginTop: 4 },
  hint: { fontSize: 11, color: "#4a5060", marginTop: 4, lineHeight: 16 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  photoSlot: { width: "31%", aspectRatio: 1, borderRadius: 10, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  photoEmpty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: "#2a2d3a", alignItems: "center", justifyContent: "center" },
  photoPlus: { fontSize: 24, color: "#4a5060" },
  inboxBtn: { marginTop: 24, backgroundColor: "#181b24", borderWidth: 1, borderColor: "#1e2230", borderRadius: 12, padding: 16, alignItems: "center" },
  inboxBtnText: { color: "#8b5cf6", fontWeight: "700", fontSize: 14 },
});
