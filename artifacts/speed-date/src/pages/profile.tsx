import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Camera, Pencil, Trash2, Check, X, ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  dateOfBirth: string | null;
  photos: string[];
  role: string | null;
  email: string | null;
}

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  uploading,
}: {
  photos: string[];
  onAdd: (file: File) => void;
  onRemove: (path: string) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slots = Array.from({ length: 12 });

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((_, i) => {
        const photo = photos[i];
        if (photo) {
          return (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-[#181b24]">
              <img
                src={`/api/storage${photo}`}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => onRemove(photo)}
                  className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        }
        const isNext = i === photos.length;
        return (
          <button
            key={i}
            onClick={() => isNext && inputRef.current?.click()}
            disabled={!isNext || uploading}
            className={cn(
              "aspect-square rounded-xl border-2 border-dashed flex items-center justify-center transition-all",
              isNext
                ? "border-primary/50 hover:border-primary hover:bg-primary/5 cursor-pointer"
                : "border-border/30 cursor-default opacity-40",
            )}
          >
            {isNext && (
              uploading
                ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <Plus size={20} className="text-muted-foreground" />
            )}
          </button>
        );
      })}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function ProfilePage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ageError, setAgeError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDob, setEditDob] = useState("");

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    fetch("/api/profile/me", { credentials: "include" })
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
      if (age < 18) {
        setAgeError("You must be 18 or older to use Intermingled.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          bio: editBio.trim(),
          dateOfBirth: editDob || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAgeError(err.error ?? "Failed to save");
        return;
      }
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhoto = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: get presigned URL
      const urlRes = await fetch("/api/profile/me/photos/upload-url", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json();
        alert(err.error ?? "Upload failed");
        return;
      }
      const { uploadURL, objectPath } = await urlRes.json();

      // Step 2: upload directly to GCS
      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // Step 3: register the photo on the profile
      const addRes = await fetch("/api/profile/me/photos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
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
    const res = await fetch("/api/profile/me/photos", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath }),
    });
    if (!res.ok) return;
    const { photos } = await res.json();
    setProfile((p) => p ? { ...p, photos } : p);
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clerkUser) {
    setLocation("/sign-in");
    return null;
  }

  const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
  const hasPhotos = (profile?.photos?.length ?? 0) > 0;
  const coverPhoto = profile?.photos?.[0];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-bold text-lg flex-1">My Profile</span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Pencil size={16} /> Edit
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(false); setAgeError(null); }} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
              <X size={18} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto pb-24">
        {/* Cover / main photo */}
        <div className="relative h-80 bg-gradient-to-b from-primary/20 to-background">
          {coverPhoto && (
            <img
              src={`/api/storage${coverPhoto}`}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

          {/* Profile info overlay */}
          <div className="absolute bottom-4 left-4 right-4">
            {editing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                placeholder="Your name"
                className="text-3xl font-bold bg-transparent border-b-2 border-primary text-white w-full outline-none placeholder:text-white/50"
              />
            ) : (
              <h1 className="text-3xl font-bold text-white drop-shadow">
                {profile?.name}{age !== null && <span className="font-normal text-white/80">, {age}</span>}
              </h1>
            )}
          </div>
        </div>

        <div className="px-4 py-5 space-y-6">
          {/* Age verification */}
          {(editing || !profile?.dateOfBirth) && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Date of Birth <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={editDob}
                onChange={(e) => { setEditDob(e.target.value); setAgeError(null); }}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                disabled={!editing}
                className="w-full bg-[#181b24] border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {ageError && <p className="text-red-400 text-sm">{ageError}</p>}
              <p className="text-xs text-muted-foreground">You must be 18+ to use Intermingled. This is verified and cannot be changed.</p>
            </div>
          )}

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">About me</label>
            {editing ? (
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Tell potential matches about yourself..."
                className="w-full bg-[#181b24] border border-border rounded-lg px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile?.bio || (
                  <span className="italic text-muted-foreground/50">No bio yet. Tap Edit to add one.</span>
                )}
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                Photos <span className="text-muted-foreground/50">({profile?.photos?.length ?? 0}/12)</span>
              </label>
              {!hasPhotos && (
                <span className="text-xs text-amber-400">Add at least 1 photo to start matching</span>
              )}
            </div>
            <PhotoGrid
              photos={profile?.photos ?? []}
              onAdd={handleAddPhoto}
              onRemove={handleRemovePhoto}
              uploading={uploading}
            />
            <p className="text-xs text-muted-foreground">
              Up to 12 photos · Images are reviewed for appropriateness
            </p>
          </div>

          {/* Inbox link */}
          <button
            onClick={() => setLocation("/inbox")}
            className="w-full flex items-center justify-between bg-[#181b24] border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="text-left">
              <div className="font-semibold text-sm">Messages</div>
              <div className="text-xs text-muted-foreground mt-0.5">View your matches & conversations</div>
            </div>
            <ArrowLeft size={18} className="text-muted-foreground rotate-180 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
