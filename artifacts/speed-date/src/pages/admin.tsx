import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  ArrowUpRight,
  Ban,
  BarChart3,
  ChevronRight,
  Crown,
  Flame,
  Flag,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Tv2,
  Users,
} from "lucide-react";
import {
  getGetAdminQuestionAnalyticsQueryKey,
  getGetAdminGuardianQueryKey,
  useGetAdminQuestionAnalytics,
  useGetAdminGuardian,
  type QuestionGroupPerformanceSnapshot,
  type GuardianDashboard,
  type QuestionIntelligenceDashboard,
  type QuestionPerformanceSnapshot,
  type QuestionTrendPoint,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "users" | "reports" | "rooms" | "questions" | "analytics" | "guardian";
type QuestionCategory = "general" | "fun" | "deep";
type QuestionDifficulty = "easy" | "medium" | "hard";

interface Stats { totalUsers: number; totalRooms: number; openReports: number; }
interface AdminUser { id: string; name: string; email: string | null; role: string | null; status: string; isAdmin: boolean; isBanned: boolean; gender: string | null; createdAt: string; }
interface Report { id: string; reporterId: string; reporterName: string; reportedId: string; reportedName: string; reportedIsBanned: boolean; reason: string; detail: string | null; createdAt: string; }
interface Room { id: string; code: string; status: string; chooserName: string | null; winnerName: string | null; currentRound: number; createdAt: string; }
interface QuestionRow {
  id: string;
  packSlug: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
interface QuestionPackSummary { packSlug: string; total: number; active: number; }

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={cn("p-3 rounded-lg", color)}><Icon size={20} className="text-white" /></div>
      <div>
        <p className="text-2xl font-black font-display">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [packs, setPacks] = useState<QuestionPackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCategory, setQuestionCategory] = useState<"all" | QuestionCategory>("all");
  const [questionDifficulty, setQuestionDifficulty] = useState<"all" | QuestionDifficulty>("all");
  const [questionPack, setQuestionPack] = useState("all");
  const [showArchivedQuestions, setShowArchivedQuestions] = useState(false);
  const [analyticsLimit, setAnalyticsLimit] = useState(10);
  const [analyticsDays, setAnalyticsDays] = useState(14);
  const [newQuestion, setNewQuestion] = useState({
    content: "",
    packSlug: "core",
    category: "general" as QuestionCategory,
    difficulty: "easy" as QuestionDifficulty,
  });

  const apiFetch = (path: string, opts?: RequestInit) =>
    fetch(`/api${path}`, { credentials: "include", ...opts });

  const analyticsQuery = useGetAdminQuestionAnalytics(
    { limit: analyticsLimit, days: analyticsDays },
    {
      query: {
        enabled: isLoaded && Boolean(clerkUser) && tab === "analytics",
        queryKey: getGetAdminQuestionAnalyticsQueryKey({ limit: analyticsLimit, days: analyticsDays }),
      },
    },
  );

  const guardianQuery = useGetAdminGuardian({
    query: {
      enabled: isLoaded && Boolean(clerkUser) && tab === "guardian",
      queryKey: getGetAdminGuardianQueryKey(),
    },
  });

  const loadStats = async () => {
    const r = await apiFetch("/admin/stats");
    if (r.status === 403) { setError("forbidden"); return; }
    setStats(await r.json());
  };

  const loadUsers = async () => {
    const r = await apiFetch("/admin/users");
    if (r.ok) setUsers(await r.json());
  };

  const loadReports = async () => {
    const r = await apiFetch("/admin/reports");
    if (r.ok) setReports(await r.json());
  };

  const loadRooms = async () => {
    const r = await apiFetch("/admin/rooms");
    if (r.ok) setRooms(await r.json());
  };

  const loadQuestionPacks = async () => {
    const r = await apiFetch("/admin/question-packs");
    if (r.ok) setPacks(await r.json());
  };

  const loadQuestions = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "100");
    if (questionSearch.trim()) params.set("search", questionSearch.trim());
    if (questionCategory !== "all") params.set("category", questionCategory);
    if (questionDifficulty !== "all") params.set("difficulty", questionDifficulty);
    if (questionPack !== "all") params.set("packSlug", questionPack);
    params.set("isActive", showArchivedQuestions ? "false" : "true");

    const r = await apiFetch(`/admin/questions?${params.toString()}`);
    if (!r.ok) return;
    const payload = await r.json();
    setQuestions(payload.items ?? []);
  };

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadReports(), loadRooms(), loadQuestionPacks(), loadQuestions()]).finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    loadQuestions();
  }, [questionSearch, questionCategory, questionDifficulty, questionPack, showArchivedQuestions]);

  useEffect(() => {
    if (isLoaded && !clerkUser) setLocation("/sign-in");
  }, [isLoaded, clerkUser]);

  const action = async (path: string, id: string) => {
    setActionLoading(id);
    try {
      await apiFetch(path, { method: "POST" });
      await Promise.all([loadUsers(), loadReports()]);
    } finally { setActionLoading(null); }
  };

  const createQuestion = async () => {
    if (!newQuestion.content.trim()) return;
    setActionLoading("question-create");
    try {
      const r = await apiFetch("/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newQuestion),
      });
      if (r.status === 409) {
        setError("duplicate-question");
        return;
      }
      setError(null);
      setNewQuestion((prev) => ({ ...prev, content: "" }));
      await Promise.all([loadQuestions(), loadQuestionPacks()]);
    } finally {
      setActionLoading(null);
    }
  };

  const archiveQuestion = async (id: string) => {
    setActionLoading(`question-${id}`);
    try {
      await apiFetch(`/admin/questions/${id}/archive`, { method: "POST" });
      await Promise.all([loadQuestions(), loadQuestionPacks()]);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleQuestionActive = async (id: string, isActive: boolean) => {
    setActionLoading(`question-${id}`);
    try {
      await apiFetch(`/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      await Promise.all([loadQuestions(), loadQuestionPacks()]);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error === "forbidden") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-4">
        <Shield size={48} className="text-destructive" />
        <h1 className="font-display font-black text-2xl uppercase tracking-wide text-destructive">Access Denied</h1>
        <p className="text-muted-foreground text-sm">This account does not have admin privileges.</p>
        <button onClick={() => setLocation("/")} className="text-primary text-sm hover:underline">← Back to home</button>
      </div>
    );
  }

  const TABS = [
    { id: "overview" as Tab, label: "Overview", icon: Tv2 },
    { id: "users" as Tab, label: `Users (${users.length})`, icon: Users },
    { id: "reports" as Tab, label: `Reports (${reports.length})`, icon: Flag },
    { id: "rooms" as Tab, label: `Rooms (${rooms.length})`, icon: ChevronRight },
    { id: "questions" as Tab, label: `Questions (${questions.length})`, icon: RefreshCw },
    { id: "analytics" as Tab, label: "Question Health", icon: BarChart3 },
    { id: "guardian" as Tab, label: "Guardian", icon: Shield },
  ];

  const filteredUsers = userSearch
    ? users.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-secondary" />
          <span className="font-display font-black text-lg uppercase tracking-wide">Admin Panel</span>
        </div>
        <button onClick={() => setLocation("/")} className="text-xs text-muted-foreground hover:text-foreground font-mono">← Exit</button>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-6 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-mono uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Overview */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Stat icon={Users} label="Total Users" value={stats.totalUsers} color="bg-primary" />
              <Stat icon={Tv2} label="Total Rooms" value={stats.totalRooms} color="bg-secondary" />
              <Stat icon={Flag} label="Reports" value={stats.openReports} color="bg-destructive" />
            </div>

            {/* Recent reports preview */}
            {reports.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-display font-black uppercase tracking-wide text-sm text-muted-foreground">Recent Reports</h2>
                <div className="space-y-2">
                  {reports.slice(0, 5).map((r) => (
                    <div key={r.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                      <div>
                        <span className="font-semibold text-sm">{r.reportedName}</span>
                        <span className="text-muted-foreground text-xs ml-2 font-mono">reported for: {r.reason}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.reportedIsBanned ? (
                          <span className="text-xs font-mono text-destructive bg-destructive/10 px-2 py-1 rounded">BANNED</span>
                        ) : (
                          <button onClick={() => action(`/admin/users/${r.reportedId}/ban`, r.reportedId)}
                            disabled={actionLoading === r.reportedId}
                            className="text-xs font-mono text-destructive border border-destructive/30 px-3 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50">
                            Ban
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {reports.length > 5 && (
                  <button onClick={() => setTab("reports")} className="text-xs text-primary hover:underline font-mono">
                    View all {reports.length} reports →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div className="space-y-4">
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <div key={u.id} className={cn(
                  "flex items-center justify-between bg-card border rounded-xl px-4 py-3",
                  u.isBanned ? "border-destructive/30 bg-destructive/5" : "border-border"
                )}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{u.name}</span>
                      {u.isAdmin && <span className="text-[10px] font-mono text-secondary bg-secondary/10 px-1.5 py-0.5 rounded uppercase">Admin</span>}
                      {u.isBanned && <span className="text-[10px] font-mono text-destructive bg-destructive/10 px-1.5 py-0.5 rounded uppercase">Banned</span>}
                      {u.role && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{u.role}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email ?? "—"} · Joined {formatDate(u.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {u.isBanned ? (
                      <button onClick={() => action(`/admin/users/${u.id}/unban`, u.id)}
                        disabled={actionLoading === u.id}
                        className="text-xs font-mono text-secondary border border-secondary/30 px-3 py-1 rounded hover:bg-secondary/10 transition-colors disabled:opacity-50">
                        {actionLoading === u.id ? "…" : "Unban"}
                      </button>
                    ) : (
                      <button onClick={() => action(`/admin/users/${u.id}/ban`, u.id)}
                        disabled={actionLoading === u.id}
                        className="text-xs font-mono text-destructive border border-destructive/30 px-3 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50">
                        {actionLoading === u.id ? "…" : "Ban"}
                      </button>
                    )}
                    {!u.isAdmin ? (
                      <button onClick={() => action(`/admin/users/${u.id}/grant-admin`, u.id)}
                        disabled={actionLoading === u.id}
                        className="text-xs font-mono text-muted-foreground border border-border px-3 py-1 rounded hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50">
                        {actionLoading === u.id ? "…" : "Admin"}
                      </button>
                    ) : (
                      <button onClick={() => action(`/admin/users/${u.id}/revoke-admin`, u.id)}
                        disabled={actionLoading === u.id}
                        className="text-xs font-mono text-secondary border border-secondary/30 px-3 py-1 rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50">
                        {actionLoading === u.id ? "…" : "Revoke"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8 font-mono">No users found</p>
              )}
            </div>
          </div>
        )}

        {/* Reports */}
        {tab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-12 font-mono">No reports yet</p>
            )}
            {reports.map((r) => (
              <div key={r.id} className={cn(
                "bg-card border rounded-xl px-5 py-4 space-y-2",
                r.reportedIsBanned ? "border-destructive/20" : "border-border"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.reportedName}</span>
                      <span className="text-xs font-mono text-destructive/80 bg-destructive/10 px-2 py-0.5 rounded">{r.reason}</span>
                      {r.reportedIsBanned && <span className="text-xs font-mono text-destructive">BANNED</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">Reported by {r.reporterName} · {formatDate(r.createdAt)}</p>
                    {r.detail && <p className="text-xs text-muted-foreground mt-1 italic">"{r.detail}"</p>}
                  </div>
                  <div className="shrink-0 flex gap-2">
                    {r.reportedIsBanned ? (
                      <button onClick={() => action(`/admin/users/${r.reportedId}/unban`, r.reportedId)}
                        disabled={actionLoading === r.reportedId}
                        className="text-xs font-mono text-secondary border border-secondary/30 px-3 py-1 rounded hover:bg-secondary/10 transition-colors disabled:opacity-50">
                        {actionLoading === r.reportedId ? "…" : "Unban"}
                      </button>
                    ) : (
                      <button onClick={() => action(`/admin/users/${r.reportedId}/ban`, r.reportedId)}
                        disabled={actionLoading === r.reportedId}
                        className="text-xs font-mono text-destructive border border-destructive/30 px-3 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50">
                        {actionLoading === r.reportedId ? "…" : "Ban"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rooms */}
        {tab === "rooms" && (
          <div className="space-y-2">
            {rooms.map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-secondary">{r.code}</span>
                    <span className={cn("text-[10px] font-mono uppercase px-2 py-0.5 rounded",
                      r.status === "active" ? "bg-secondary/10 text-secondary" :
                      r.status === "ended" ? "bg-muted text-muted-foreground" :
                      "bg-primary/10 text-primary"
                    )}>{r.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.chooserName ?? "—"} · Round {r.currentRound}
                    {r.winnerName ? ` · Winner: ${r.winnerName}` : ""}
                    {" · "}{formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            {rooms.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-12 font-mono">No rooms yet</p>
            )}
          </div>
        )}

        {tab === "questions" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h2 className="font-display font-black uppercase tracking-wide text-sm">Create Question</h2>
              <textarea
                value={newQuestion.content}
                onChange={(e) => setNewQuestion((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Write a new prompt..."
                className="w-full min-h-24 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  value={newQuestion.packSlug}
                  onChange={(e) => setNewQuestion((prev) => ({ ...prev, packSlug: e.target.value }))}
                  placeholder="Pack slug"
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion((prev) => ({ ...prev, category: e.target.value as QuestionCategory }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="general">general</option>
                  <option value="fun">fun</option>
                  <option value="deep">deep</option>
                </select>
                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion((prev) => ({ ...prev, difficulty: e.target.value as QuestionDifficulty }))}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
                <button
                  onClick={createQuestion}
                  disabled={actionLoading === "question-create"}
                  className="text-sm font-mono border border-primary text-primary rounded-lg px-3 py-2 hover:bg-primary/10 disabled:opacity-50"
                >
                  {actionLoading === "question-create" ? "Creating..." : "Create"}
                </button>
              </div>
              {error === "duplicate-question" && (
                <p className="text-xs text-destructive font-mono">Duplicate question content detected.</p>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
              <input
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search question text"
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={questionPack}
                onChange={(e) => setQuestionPack(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">all packs</option>
                {packs.map((pack) => (
                  <option key={pack.packSlug} value={pack.packSlug}>{pack.packSlug}</option>
                ))}
              </select>
              <select
                value={questionCategory}
                onChange={(e) => setQuestionCategory(e.target.value as "all" | QuestionCategory)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">all categories</option>
                <option value="general">general</option>
                <option value="fun">fun</option>
                <option value="deep">deep</option>
              </select>
              <select
                value={questionDifficulty}
                onChange={(e) => setQuestionDifficulty(e.target.value as "all" | QuestionDifficulty)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">all difficulties</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
              <button
                onClick={() => setShowArchivedQuestions((prev) => !prev)}
                className={cn(
                  "text-xs font-mono border rounded-lg px-3 py-2",
                  showArchivedQuestions ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground",
                )}
              >
                {showArchivedQuestions ? "Showing archived" : "Showing active"}
              </button>
            </div>

            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{q.content}</p>
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted">{q.packSlug}</span>
                      <span className="px-2 py-0.5 rounded bg-muted">{q.category}</span>
                      <span className="px-2 py-0.5 rounded bg-muted">{q.difficulty}</span>
                      <span className={cn("px-2 py-0.5 rounded", q.isActive ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive")}>{q.isActive ? "active" : "archived"}</span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {q.isActive ? (
                      <button
                        onClick={() => archiveQuestion(q.id)}
                        disabled={actionLoading === `question-${q.id}`}
                        className="text-xs font-mono text-destructive border border-destructive/30 px-3 py-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleQuestionActive(q.id, true)}
                        disabled={actionLoading === `question-${q.id}`}
                        className="text-xs font-mono text-secondary border border-secondary/30 px-3 py-1 rounded hover:bg-secondary/10 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-10 font-mono">No questions found</p>
              )}
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard icon={Sparkles} label="Active Questions" value={analyticsQuery.data?.exposureMetrics.activeQuestions ?? 0} tone="primary" />
              <MetricCard icon={Flame} label="Recent Exposures" value={analyticsQuery.data?.exposureMetrics.recentExposureCount ?? 0} tone="secondary" />
              <MetricCard icon={Target} label="Total Exposures" value={analyticsQuery.data?.exposureMetrics.totalExposureCount ?? 0} tone="neutral" />
              <MetricCard icon={Crown} label="Avg Per Question" value={analyticsQuery.data?.exposureMetrics.averageExposurePerQuestion ?? 0} tone="accent" />
            </div>

            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-end gap-3 md:justify-between">
                <div>
                  <h2 className="font-display font-black uppercase tracking-wide text-sm">Question Intelligence</h2>
                  <p className="text-xs text-muted-foreground mt-1">Contracted analytics from <span className="font-mono">GET /admin/question-analytics</span>.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={analyticsLimit}
                    onChange={(event) => setAnalyticsLimit(Number(event.target.value))}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono uppercase"
                  >
                    {[5, 10, 20, 50].map((value) => (
                      <option key={value} value={value}>{value} rows</option>
                    ))}
                  </select>
                  <select
                    value={analyticsDays}
                    onChange={(event) => setAnalyticsDays(Number(event.target.value))}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono uppercase"
                  >
                    {[7, 14, 30, 60].map((value) => (
                      <option key={value} value={value}>{value} days</option>
                    ))}
                  </select>
                </div>
              </div>

              {analyticsQuery.isLoading && (
                <div className="grid gap-3">
                  <div className="h-28 rounded-xl bg-muted animate-pulse" />
                  <div className="h-28 rounded-xl bg-muted animate-pulse" />
                </div>
              )}

              {analyticsQuery.isError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  Could not load question intelligence.
                </div>
              )}

              {analyticsQuery.data && (
                <AnalyticsDashboard data={analyticsQuery.data} />
              )}
            </div>
          </div>
        )}

        {tab === "guardian" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Stat icon={Flag} label="Reports" value={guardianQuery.data?.overview.totalReports ?? 0} color="bg-destructive" />
              <Stat icon={Shield} label="Blocks" value={guardianQuery.data?.overview.totalBlocks ?? 0} color="bg-secondary" />
              <Stat icon={Ban} label="Banned Users" value={guardianQuery.data?.overview.bannedUsers ?? 0} color="bg-primary" />
              <Stat icon={ArrowUpRight} label="Recent Reports" value={guardianQuery.data?.overview.recentReportCount ?? 0} color="bg-muted-foreground" />
              <Stat icon={Sparkles} label="Recent Blocks" value={guardianQuery.data?.overview.recentBlockCount ?? 0} color="bg-accent" />
            </div>

            {guardianQuery.isLoading && (
              <div className="grid gap-3">
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-24 rounded-xl bg-muted animate-pulse" />
              </div>
            )}

            {guardianQuery.isError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                Could not load guardian moderation data.
              </div>
            )}

            {guardianQuery.data && <GuardianDashboardPanel data={guardianQuery.data} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: "primary" | "secondary" | "neutral" | "accent";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary"
      : tone === "secondary"
        ? "bg-secondary"
        : tone === "accent"
          ? "bg-destructive"
          : "bg-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={cn("p-3 rounded-lg", toneClass)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-black font-display">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function AnalyticsDashboard({ data }: { data: QuestionIntelligenceDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard
          title="Leaderboard"
          icon={ArrowUpRight}
          rows={data.leaderboard}
          primaryMetric={(row) => row.qualityScore}
          secondaryMetric={(row) => `${row.packSlug} · ${row.category} · ${row.difficulty}`}
          rightMetric={(row) => `${row.exposureCount} exposures`}
          badge={(row) => (row.suggestedPromote ? "promote" : row.suggestedArchive ? "review" : "stable")}
        />
        <RankingCard
          title="Lowest Performing"
          icon={Target}
          rows={data.lowestPerforming}
          primaryMetric={(row) => row.qualityScore}
          secondaryMetric={(row) => `${row.packSlug} · ${row.category} · ${row.difficulty}`}
          rightMetric={(row) => `${Math.round((row.skipRate ?? 0) * 100)}% skip`}
          badge={(row) => (row.suggestedArchive ? "archive" : row.suggestedPromote ? "promote" : "review")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GroupRankingCard title="Pack Rankings" rows={data.packRankings} />
        <GroupRankingCard title="Category Rankings" rows={data.categoryRankings} />
        <GroupRankingCard title="Difficulty Rankings" rows={data.difficultyRankings} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendCard title="Rating Trends" icon={Flame} rows={data.ratingTrends} metricLabel="avg rating" />
        <TrendCard title="Response Time Trends" icon={RefreshCw} rows={data.responseTimeTrends} metricLabel="avg seconds" />
      </div>
    </div>
  );
}

function RankingCard<T extends { questionId: string; content: string }>({
  title,
  icon: Icon,
  rows,
  primaryMetric,
  secondaryMetric,
  rightMetric,
  badge,
}: {
  title: string;
  icon: any;
  rows: T[];
  primaryMetric: (row: T) => number;
  secondaryMetric: (row: T) => string;
  rightMetric: (row: T) => string;
  badge: (row: T) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        <Icon size={12} /> {title}
      </div>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.questionId} className="border border-border/70 rounded-xl px-3 py-3 bg-background/40 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono uppercase text-muted-foreground">#{index + 1}</div>
                <div className="text-sm font-semibold line-clamp-2">{row.content}</div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-muted text-muted-foreground shrink-0">
                {badge(row)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono uppercase text-muted-foreground">
              <span>{secondaryMetric(row)}</span>
              <span>{rightMetric(row)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono uppercase">
              <span className="text-muted-foreground">Score</span>
              <span className="text-primary font-bold">{primaryMetric(row)}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No data yet</div>}
      </div>
    </div>
  );
}

function GroupRankingCard({ title, rows }: { title: string; rows: QuestionGroupPerformanceSnapshot[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row) => (
          <div key={row.groupValue} className="border border-border/70 rounded-xl px-3 py-3 bg-background/40">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-sm capitalize">{row.groupValue}</div>
              <div className="text-xs font-mono text-muted-foreground">{row.questionCount} q</div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs font-mono uppercase text-muted-foreground">
              <span>Score: {row.averageQualityScore ?? "—"}</span>
              <span>Exposures: {row.exposureCount}</span>
              <span>Promote: {row.suggestedPromoteCount}</span>
              <span>Archive: {row.suggestedArchiveCount}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No data yet</div>}
      </div>
    </div>
  );
}

function TrendCard({
  title,
  icon: Icon,
  rows,
  metricLabel,
}: {
  title: string;
  icon: any;
  rows: QuestionTrendPoint[];
  metricLabel: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
        <Icon size={12} /> {title}
      </div>
      <div className="space-y-2">
        {rows.slice(-7).map((row) => (
          <div key={row.bucket} className="flex items-center justify-between gap-3 border border-border/70 rounded-xl px-3 py-2 bg-background/40">
            <div>
              <div className="text-sm font-semibold">{row.bucket}</div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">{row.exposureCount} exposures · {row.ratingCount} ratings</div>
            </div>
            <div className="text-xs font-mono uppercase text-primary">
              {metricLabel === "avg rating"
                ? (row.averageRating ?? 0).toFixed(2)
                : row.averageResponseTimeSeconds == null
                  ? "—"
                  : `${row.averageResponseTimeSeconds.toFixed(2)}s`}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No data yet</div>}
      </div>
    </div>
  );
}

function GuardianDashboardPanel({ data }: { data: GuardianDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Recent Reports</div>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {data.recentReports.map((report) => (
              <div key={report.id} className="border border-border/70 rounded-xl px-3 py-3 bg-background/40 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{report.reportedName}</div>
                    <div className="text-xs text-muted-foreground font-mono uppercase">By {report.reporterName}</div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono uppercase px-2 py-1 rounded shrink-0",
                    report.reportedIsBanned ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                  )}>
                    {report.reason}
                  </span>
                </div>
                {report.detail && <div className="text-xs text-muted-foreground italic">{report.detail}</div>}
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {data.recentReports.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No reports yet</div>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Recent Blocks</div>
          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {data.recentBlocks.map((block) => (
              <div key={`${block.blockerId}-${block.blockedId}-${block.createdAt}`} className="border border-border/70 rounded-xl px-3 py-3 bg-background/40">
                <div className="text-sm font-semibold">{block.blockerName} → {block.blockedName}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">{new Date(block.createdAt).toLocaleString()}</div>
              </div>
            ))}
            {data.recentBlocks.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No blocks yet</div>}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Top Reported Users</div>
        <div className="space-y-2">
          {data.topReportedUsers.map((user) => (
            <div key={user.userId} className="border border-border/70 rounded-xl px-3 py-3 bg-background/40 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{user.userName}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{user.userId}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-muted text-muted-foreground">
                  {user.reportCount} reports
                </span>
                {user.isBanned && <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-destructive/10 text-destructive">banned</span>}
              </div>
            </div>
          ))}
          {data.topReportedUsers.length === 0 && <div className="text-sm text-muted-foreground font-mono text-center py-8">No report trends yet</div>}
        </div>
      </div>
    </div>
  );
}
