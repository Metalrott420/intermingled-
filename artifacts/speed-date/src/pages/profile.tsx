import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Camera, Pencil, Trash2, Check, X, ArrowLeft, Plus, MessageSquare, Flag, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfilePrompt { question: string; answer: string; }

type Gender = "man" | "woman" | "nonbinary" | "other";
type ShowMe = "men" | "women" | "everyone";

interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  dateOfBirth: string | null;
  photos: string[];
  profilePrompts: ProfilePrompt[];
  role: string | null;
  email: string | null;
  gender: Gender | null;
  showMeGender: ShowMe | null;
}

const PROMPT_OPTIONS = [
  "My most controversial opinion is...",
  "The way to my heart is...",
  "You'll know I like you when...",
  "My biggest green flag is...",
  "A perfect Sunday looks like...",
  "I'm weirdly into...",
  "Two truths and a lie...",
  "The most spontaneous thing I've done...",
  "My love language is...",
  "The key to winning me over...",
];

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function PhotoGrid({ photos, onAdd, onRemove, uploading }: {
  photos: string[]; onAdd: (f: File) => void; onRemove: (p: string) => void; uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slots = Array.from({ length: 12 });
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((_, i) => {
        const photo = photos[i];
        if (photo) {
          return (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group bg-card border border-border">
              <img src={`/api/storage${photo}`} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => onRemove(photo)} className="p-2 rounded-full bg-destructive/90 hover:bg-destructive text-white transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              {i === 0 && (
                <div className="absolute top-2 left-2 bg-secondary/90 text-secondary-foreground text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono">
                  MAIN
                </div>
              )}
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
                ? "border-primary/40 hover:border-primary hover:bg-primary/5 cursor-pointer"
                : "border-border/20 cursor-default opacity-30",
            )}
          >
            {isNext && (
              uploading
                ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                : <Plus size={18} className="text-muted-foreground" />
            )}
          </button>
        );
      })}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
    </div>
  );
}

// ── Report Modal ──────────────────────────────────────────────────────────────
function ReportModal({ targetId, targetName, onClose }: { targetId: string; targetName: string; onClose: () => void }) {
  const REASONS = ["Fake profile", "Inappropriate content", "Harassment", "Spam", "Underage", "Other"];
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await fetch(`/api/users/${targetId}/report`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail }),
      });
      // Also block
      await fetch(`/api/users/${targetId}/block`, { method: "POST", credentials: "include" });
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4 shadow-2xl">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <Check size={40} className="mx-auto text-secondary" />
            <h3 className="font-display font-black uppercase tracking-wide text-lg">Report Submitted</h3>
            <p className="text-sm text-muted-foreground">{targetName} has been reported and blocked.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black uppercase tracking-wide">Report {targetName}</h3>
              <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <p className="text-xs text-muted-foreground">Select a reason. This user will be blocked.</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  className={cn("text-xs py-2 px-3 rounded-lg border text-left font-mono transition-all", reason === r
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : "border-border/60 text-muted-foreground hover:border-border"
                  )}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Additional details (optional)"
              rows={2} className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-destructive" />
            <button onClick={handleSubmit} disabled={!reason || loading}
              className="w-full py-3 bg-destructive text-destructive-foreground rounded-xl font-bold uppercase tracking-widest text-sm disabled:opacity-50 transition-opacity">
              {loading ? "Submitting..." : "Submit Report & Block"}
            </button>
          </>
        )}
      </div>
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
  const [showReport, setShowReport] = useState(false);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editGender, setEditGender] = useState<Gender | "">("");
  const [editShowMe, setEditShowMe] = useState<ShowMe>("everyone");
  const [editPrompts, setEditPrompts] = useState<ProfilePrompt[]>([]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser) { setLoading(false); return; }
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setEditName(data.name ?? "");
        setEditBio(data.bio ?? "");
        setEditDob(data.dateOfBirth ?? "");
        setEditGender((data.gender as Gender) ?? "");
        setEditShowMe((data.showMeGender as ShowMe) ?? "everyone");
        setEditPrompts(data.profilePrompts ?? []);
      })
      .finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

  const handleSave = async () => {
    if (!profile) return;
    setAgeError(null);
    if (editDob) {
      const age = calculateAge(editDob);
      if (age < 18) { setAgeError("You must be 18 or older to use Intermingled."); return; }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          bio: editBio.trim(),
          dateOfBirth: editDob || undefined,
          profilePrompts: editPrompts,
          gender: editGender || undefined,
          showMeGender: editShowMe,
        }),
      });
      if (!res.ok) { const err = await res.json(); setAgeError(err.error ?? "Failed to save"); return; }
      const updated = await res.json();
      setProfile(updated);
      setEditing(false);
    } finally { setSaving(false); }
  };

  const handleAddPhoto = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/profile/me/photos/upload-url", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) { const err = await urlRes.json(); alert(err.error ?? "Upload failed"); return; }
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const addRes = await fetch("/api/profile/me/photos", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath }),
      });
      if (!addRes.ok) return;
      const { photos } = await addRes.json();
      setProfile((p) => p ? { ...p, photos } : p);
    } finally { setUploading(false); }
  };

  const handleRemovePhoto = async (objectPath: string) => {
    const res = await fetch("/api/profile/me/photos", {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPath }),
    });
    if (!res.ok) return;
    const { photos } = await res.json();
    setProfile((p) => p ? { ...p, photos } : p);
  };

  const addPrompt = () => {
    const used = editPrompts.map((p) => p.question);
    const available = PROMPT_OPTIONS.filter((q) => !used.includes(q));
    if (!available.length || editPrompts.length >= 3) return;
    setEditPrompts((prev) => [...prev, { question: available[0], answer: "" }]);
  };

  const updatePrompt = (i: number, field: keyof ProfilePrompt, val: string) => {
    setEditPrompts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };

  const removePrompt = (i: number) => setEditPrompts((prev) => prev.filter((_, idx) => idx !== i));

  const GENDER_LABELS: Record<Gender, string> = { man: "Man", woman: "Woman", nonbinary: "Non-binary", other: "Other" };
  const SHOW_ME_LABELS: Record<ShowMe, string> = { men: "Men", women: "Women", everyone: "Everyone" };

  useEffect(() => {
    if (isLoaded && !clerkUser && !loading) setLocation("/sign-in");
  }, [isLoaded, clerkUser, loading]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!clerkUser) return null;

  const age = profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null;
  const hasPhotos = (profile?.photos?.length ?? 0) > 0;
  const coverPhoto = profile?.photos?.[0];
  const displayPrompts = editing ? editPrompts : (profile?.profilePrompts ?? []);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {showReport && profile && (
        <ReportModal targetId={profile.id} targetName={profile.name} onClose={() => setShowReport(false)} />
      )}

      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display font-black text-lg flex-1 uppercase tracking-wide">My Profile</span>
        {!editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
              <Pencil size={15} /> Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(false); setAgeError(null); setEditPrompts(profile?.profilePrompts ?? []); }}
              className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><X size={18} /></button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
              Save
            </button>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto pb-24">
        {/* Cover photo */}
        <div className="relative h-72 bg-gradient-to-b from-primary/20 to-background">
          {coverPhoto && <img src={`/api/storage${coverPhoto}`} alt="Cover" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            {editing ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80}
                placeholder="Your name"
                className="font-display text-3xl font-black bg-transparent border-b-2 border-primary text-white w-full outline-none placeholder:text-white/40 uppercase tracking-wide" />
            ) : (
              <h1 className="font-display text-3xl font-black text-white drop-shadow uppercase tracking-wide">
                {profile?.name}{age !== null && <span className="font-normal normal-case text-white/70 text-2xl">, {age}</span>}
              </h1>
            )}
          </div>
        </div>

        <div className="px-4 py-5 space-y-6">
          {/* Age */}
          {(editing || !profile?.dateOfBirth) && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
                Date of Birth <span className="text-destructive">*</span>
              </label>
              <input type="date" value={editDob} onChange={(e) => { setEditDob(e.target.value); setAgeError(null); }}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                disabled={!editing}
                className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" />
              {ageError && <p className="text-destructive text-sm">{ageError}</p>}
            </div>
          )}

          {/* Bio */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">About Me</label>
            {editing ? (
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} maxLength={500} rows={4}
                placeholder="Tell potential matches about yourself..."
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary" />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {profile?.bio || <span className="italic text-muted-foreground/40">No bio yet. Tap Edit to add one.</span>}
              </p>
            )}
          </div>

          {/* Gender & Show Me */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">I am a</label>
              {editing ? (
                <select value={editGender} onChange={(e) => setEditGender(e.target.value as Gender | "")}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Prefer not to say</option>
                  {(["man", "woman", "nonbinary", "other"] as Gender[]).map((g) => (
                    <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-foreground py-2.5">
                  {profile?.gender ? GENDER_LABELS[profile.gender] : <span className="text-muted-foreground/40 italic">Not set</span>}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">Show me</label>
              {editing ? (
                <select value={editShowMe} onChange={(e) => setEditShowMe(e.target.value as ShowMe)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {(["men", "women", "everyone"] as ShowMe[]).map((s) => (
                    <option key={s} value={s}>{SHOW_ME_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-foreground py-2.5">
                  {SHOW_ME_LABELS[profile?.showMeGender ?? "everyone"]}
                </p>
              )}
            </div>
          </div>

          {/* Profile Prompts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                <MessageSquare size={11} /> Profile Prompts
              </label>
              {editing && editPrompts.length < 3 && (
                <button onClick={addPrompt} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                  <Plus size={12} /> Add prompt
                </button>
              )}
            </div>

            {displayPrompts.length === 0 && !editing && (
              <p className="text-xs text-muted-foreground/50 italic font-mono">No prompts yet. Edit to add your personality!</p>
            )}

            <div className="space-y-2">
              {(editing ? editPrompts : displayPrompts).map((prompt, i) => (
                <div key={i} className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-2">
                  {editing ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <select value={prompt.question} onChange={(e) => updatePrompt(i, "question", e.target.value)}
                          className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                          {PROMPT_OPTIONS.map((q) => (
                            <option key={q} value={q} disabled={editPrompts.some((p, pi) => pi !== i && p.question === q)}>{q}</option>
                          ))}
                        </select>
                        <button onClick={() => removePrompt(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                      <textarea value={prompt.answer} onChange={(e) => updatePrompt(i, "answer", e.target.value)}
                        maxLength={200} rows={2} placeholder="Your answer..."
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] font-mono text-primary uppercase tracking-wider">{prompt.question}</p>
                      <p className="text-sm text-foreground">{prompt.answer}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-widest">
                Photos <span className="text-muted-foreground/50">({profile?.photos?.length ?? 0}/12)</span>
              </label>
              {!hasPhotos && <span className="text-[10px] text-secondary font-mono">Add at least 1 to start matching</span>}
            </div>
            <PhotoGrid photos={profile?.photos ?? []} onAdd={handleAddPhoto} onRemove={handleRemovePhoto} uploading={uploading} />
            <p className="text-xs text-muted-foreground font-mono">Up to 12 photos · First photo is your main profile picture</p>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <button onClick={() => setLocation("/inbox")}
              className="w-full flex items-center justify-between bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group">
              <div className="flex items-center gap-3">
                <Heart size={18} className="text-primary" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Matches & Messages</div>
                  <div className="text-xs text-muted-foreground">View your conversations</div>
                </div>
              </div>
              <ArrowLeft size={16} className="text-muted-foreground rotate-180 group-hover:text-primary transition-colors" />
            </button>

            <button onClick={() => setLocation("/who-liked-me")}
              className="w-full flex items-center justify-between bg-card border border-border rounded-xl p-4 hover:border-secondary/40 hover:bg-secondary/5 transition-all group">
              <div className="flex items-center gap-3">
                <Heart size={18} className="text-secondary" />
                <div className="text-left">
                  <div className="font-semibold text-sm">Who Liked You</div>
                  <div className="text-xs text-muted-foreground">See who's interested</div>
                </div>
              </div>
              <ArrowLeft size={16} className="text-muted-foreground rotate-180 group-hover:text-secondary transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
