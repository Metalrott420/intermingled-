import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Users, Flag, Tv2, Shield, Ban, CheckCircle, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "users" | "reports" | "rooms";

interface Stats { totalUsers: number; totalRooms: number; openReports: number; }
interface AdminUser { id: string; name: string; email: string | null; role: string | null; status: string; isAdmin: boolean; isBanned: boolean; gender: string | null; createdAt: string; }
interface Report { id: string; reporterId: string; reporterName: string; reportedId: string; reportedName: string; reportedIsBanned: boolean; reason: string; detail: string | null; createdAt: string; }
interface Room { id: string; code: string; status: string; chooserName: string | null; winnerName: string | null; currentRound: number; createdAt: string; }

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const apiFetch = (path: string, opts?: RequestInit) =>
    fetch(`/api${path}`, { credentials: "include", ...opts });

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

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    setLoading(true);
    Promise.all([loadStats(), loadUsers(), loadReports(), loadRooms()]).finally(() => setLoading(false));
  }, [isLoaded, clerkUser]);

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
      </div>
    </div>
  );
}
