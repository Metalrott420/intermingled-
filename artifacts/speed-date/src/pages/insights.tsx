import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  getGetPlayerAchievementsQueryKey,
  getGetPlayerStatsQueryKey,
  useGetPlayerAchievements,
  useGetPlayerStats,
} from "@workspace/api-client-react";
import { ArrowLeft, Award, BarChart3, Flame, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export default function InsightsPage() {
  const [, setLocation] = useLocation();
  const { isLoaded, user } = useUser();
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/profile/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Profile fetch failed");
        }
        return response.json();
      })
      .then((profile) => setDbUserId(profile.id ?? null))
      .catch(() => {
        setDbUserId(null);
        setProfileError("Unable to load your profile");
      });
  }, [isLoaded, user]);

  const statsQuery = useGetPlayerStats(dbUserId ?? "", {
    query: {
      enabled: Boolean(dbUserId),
      queryKey: getGetPlayerStatsQueryKey(dbUserId ?? ""),
    },
  });

  const achievementsQuery = useGetPlayerAchievements(dbUserId ?? "", {
    query: {
      enabled: Boolean(dbUserId),
      queryKey: getGetPlayerAchievementsQueryKey(dbUserId ?? ""),
    },
  });

  const stats = statsQuery.data;
  const achievements = achievementsQuery.data?.achievements ?? [];
  const progressCompletion = achievements.length > 0 ? Math.round((achievements.filter((entry) => entry.unlocked).length / achievements.length) * 100) : 0;

  const trendData = stats
    ? [
        { metric: "Win %", value: Math.round(stats.winPercentage), fill: "var(--color-winRate)" },
        { metric: "Match %", value: Math.round(stats.matchPercentage), fill: "var(--color-matchRate)" },
        { metric: "Streak", value: stats.streaks.maxWinStreak * 10, fill: "var(--color-streak)" },
      ]
    : [];

  const chartConfig = {
    winRate: { label: "Win %", color: "hsl(var(--chart-1))" },
    matchRate: { label: "Match %", color: "hsl(var(--chart-2))" },
    streak: { label: "Streak x10", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig;

  const isInsightsLoading = Boolean(dbUserId) && (statsQuery.isLoading || achievementsQuery.isLoading);
  const hasInsightsError = Boolean(profileError || statsQuery.isError || achievementsQuery.isError);

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => setLocation("/profile")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-black uppercase tracking-wide text-lg">Player Insights</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {isInsightsLoading && (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        )}

        {hasInsightsError && (
          <Empty className="border-destructive/30 bg-destructive/5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RefreshCw className="size-5" />
              </EmptyMedia>
              <EmptyTitle>Could not load insights</EmptyTitle>
              <EmptyDescription>{profileError ?? "Please retry in a moment."}</EmptyDescription>
            </EmptyHeader>
            <button
              onClick={() => {
                void statsQuery.refetch();
                void achievementsQuery.refetch();
              }}
              className="rounded-lg border border-border px-3 py-2 text-xs font-mono uppercase"
            >
              Retry
            </button>
          </Empty>
        )}

        {stats && (
          <>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <BarChart3 size={12} /> Statistics
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Games" value={stats.gamesPlayed} />
                <StatCard label="Wins" value={`${stats.wins} (${stats.winPercentage}%)`} />
                <StatCard label="Matches" value={`${stats.matches} (${stats.matchPercentage}%)`} />
                <StatCard label="Avg Finish" value={stats.averageFinish} />
                <StatCard
                  label="Avg Response"
                  value={stats.averageResponseTimeSeconds === null ? "N/A" : `${stats.averageResponseTimeSeconds}s`}
                />
                <StatCard label="Win Streak" value={stats.streaks.maxWinStreak} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
                <div className="text-xs font-mono uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <TrendingUp size={12} /> Win / Match Trend
                </div>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <BarChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="metric" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={8} />
                  </BarChart>
                </ChartContainer>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2 space-y-3">
                <div className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                  <Flame size={12} /> Streak Signals
                </div>
                <StreakCard label="Current Win Streak" value={stats.streaks.currentWinStreak} tone="primary" />
                <StreakCard label="Best Win Streak" value={stats.streaks.maxWinStreak} tone="secondary" />
                <StreakCard label="Current Match Streak" value={stats.streaks.currentMatchStreak} tone="muted" />
                <StreakCard label="Best Match Streak" value={stats.streaks.maxMatchStreak} tone="primary" />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <Award size={12} /> Achievements
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3 mb-3">
                <div className="flex items-center justify-between text-xs font-mono uppercase text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Sparkles size={11} /> Completion</span>
                  <span>{progressCompletion}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progressCompletion}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="border border-border/60 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{achievement.title}</div>
                        <div className="text-xs text-muted-foreground">{achievement.description}</div>
                      </div>
                      <div className={`text-xs font-mono uppercase ${achievement.unlocked ? "text-secondary" : "text-muted-foreground"}`}>
                        {achievement.unlocked ? "Unlocked" : `${achievement.progress}/${achievement.target}`}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${achievement.unlocked ? "bg-secondary" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, Math.round((achievement.progress / Math.max(achievement.target, 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}

function StreakCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "secondary" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/30 bg-primary/10"
      : tone === "secondary"
        ? "border-secondary/30 bg-secondary/10"
        : "border-border/60 bg-background/40";

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}
