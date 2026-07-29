import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  GetHistoryMatchStatus,
  getGetHistoryQueryKey,
  useGetHistory,
} from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, RefreshCw, Search, Trophy, Users } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [matchStatus, setMatchStatus] = useState<GetHistoryMatchStatus | "all">("all");
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(matchStatus === "all" ? {} : { matchStatus }),
    }),
    [page, matchStatus],
  );

  const { data, isLoading, isError, refetch, isFetching } = useGetHistory(params, {
    query: {
      queryKey: getGetHistoryQueryKey(params),
      placeholderData: keepPreviousData,
    },
  });

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const baseItems = data?.items ?? [];
    if (normalized.length === 0) {
      return baseItems;
    }

    return baseItems.filter((item) => {
      return (
        item.gameId.toLowerCase().includes(normalized) ||
        (item.winnerName ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [data?.items, search]);

  const items = filteredItems;
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-black uppercase tracking-wide text-lg">Game History</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by game ID or winner"
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPage(1);
              setMatchStatus("all");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border ${
              matchStatus === "all" ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setPage(1);
              setMatchStatus(GetHistoryMatchStatus.matched);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border ${
              matchStatus === GetHistoryMatchStatus.matched ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Matched
          </button>
          <button
            onClick={() => {
              setPage(1);
              setMatchStatus(GetHistoryMatchStatus.unmatched);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border ${
              matchStatus === GetHistoryMatchStatus.unmatched ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Unmatched
          </button>
          <button
            onClick={() => {
              setPage(1);
              setMatchStatus(GetHistoryMatchStatus.unknown);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border ${
              matchStatus === GetHistoryMatchStatus.unknown ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            Unknown
          </button>

          <button
            onClick={() => {
              setSearch("");
              setPage(1);
              void refetch();
            }}
            className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-mono uppercase text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : undefined} />
            Refresh
          </button>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {isError && (
          <Empty className="border-destructive/30 bg-destructive/5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <RefreshCw className="size-5" />
              </EmptyMedia>
              <EmptyTitle>Could not load history</EmptyTitle>
              <EmptyDescription>
                Something went wrong while fetching archived games.
              </EmptyDescription>
            </EmptyHeader>
            <button
              onClick={() => void refetch()}
              className="rounded-lg border border-border px-3 py-2 text-xs font-mono uppercase"
            >
              Try again
            </button>
          </Empty>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <Empty className="border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No games found</EmptyTitle>
              <EmptyDescription>
                {search.trim().length > 0
                  ? "No history entries match your current search."
                  : "Play and complete a game to see it archived here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={`${item.gameId}-${item.completionTimestamp}`}
              onClick={() => setLocation(`/history/${item.gameId}`)}
              className="w-full text-left rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <Trophy size={14} className="text-primary" />
                    {item.winnerName ?? "No winner"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                    <CalendarDays size={12} />
                    {new Date(item.completionTimestamp).toLocaleString()}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className={`text-xs font-mono uppercase ${item.matchStatus === "matched" ? "text-secondary" : "text-muted-foreground"}`}>
                    {item.matchStatus}
                  </div>
                  <div className="text-xs text-muted-foreground">Rounds survived: {item.roundsSurvived}</div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                    <Users size={11} /> {item.participantCount} players
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <div className="text-xs font-mono text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
