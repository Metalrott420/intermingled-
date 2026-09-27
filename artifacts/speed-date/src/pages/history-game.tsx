import { useLocation, useParams } from "wouter";
import {
  getGetHistoryGameQueryKey,
  getGetHistoryReplayQueryKey,
  useGetHistoryGame,
  useGetHistoryReplay,
} from "@workspace/api-client-react";
import { ArrowLeft, CalendarClock, Crown, MessageCircleQuestion, Timer, Users } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryGamePage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ gameId: string }>();
  const gameId = params?.gameId ?? "";

  const { data, isLoading, isError } = useGetHistoryGame(gameId, {
    query: {
      enabled: gameId.length > 0,
      queryKey: getGetHistoryGameQueryKey(gameId),
    },
  });

  const { data: replayData, isLoading: replayLoading } = useGetHistoryReplay(gameId, {
    query: {
      enabled: gameId.length > 0,
      queryKey: getGetHistoryReplayQueryKey(gameId),
    },
  });

  const participantNameById = new Map((data?.participants ?? []).map((participant) => [participant.id, participant.name]));

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b border-border px-4 h-14 flex items-center gap-3">
        <button onClick={() => setLocation("/history")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display font-black uppercase tracking-wide text-lg">Match Detail</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        )}

        {isError && (
          <Empty className="border-destructive/30 bg-destructive/5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarClock className="size-5" />
              </EmptyMedia>
              <EmptyTitle>Match detail unavailable</EmptyTitle>
              <EmptyDescription>
                We could not load this archived game right now.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {data && (
          <>
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <div className="text-xs font-mono uppercase text-muted-foreground">Game</div>
                  <div className="text-sm font-semibold mt-1 break-all">{data.gameId}</div>
                  <div className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                    <CalendarClock size={12} /> {new Date(data.completionTimestamp).toLocaleString()}
                  </div>
                </div>
                <div className={`inline-flex w-fit px-2 py-1 rounded-md text-xs font-mono uppercase ${data.matchStatus === "matched" ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                  {data.matchStatus}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricCard label="Rounds Survived" value={data.playerPerspective.roundsSurvived} />
                <MetricCard label="Player Role" value={data.playerPerspective.role} />
                <MetricCard label="Result" value={data.playerPerspective.isWinner ? "Winner" : "Eliminated"} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <Crown size={12} /> Winner
              </div>
              <div className="text-base font-semibold">{data.winnerName ?? "No winner"}</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <Users size={12} /> Participants
              </div>
              <div className="space-y-2">
                {data.participants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between gap-3 text-sm border border-border/60 rounded-lg px-3 py-2">
                    <div>
                      <div className="font-medium">{participant.name}</div>
                      <div className="text-xs text-muted-foreground">{participant.isPremium ? "Premium" : "Standard"}</div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono uppercase">{participant.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-2 flex items-center gap-2">
                <MessageCircleQuestion size={12} /> Questions
              </div>
              <div className="space-y-2">
                {data.questionsAsked.length === 0 && <div className="text-sm text-muted-foreground">No archived questions.</div>}
                {data.questionsAsked.map((question, index) => (
                  <div key={`${question.createdAt}-${index}`} className="text-sm border border-border/60 rounded-lg px-3 py-2">
                    <div className="text-xs text-muted-foreground mb-1">Round {question.round ?? "-"}</div>
                    <div>{question.content}</div>
                    <div className="text-[11px] mt-1 text-muted-foreground">Asked at {new Date(question.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Elimination Order</div>
              <div className="space-y-2">
                {data.eliminationOrder.length === 0 && (
                  <div className="text-sm text-muted-foreground">No eliminations recorded.</div>
                )}
                {data.eliminationOrder.map((participantId, index) => (
                  <div key={`${participantId}-${index}`} className="flex items-center justify-between border border-border/60 rounded-lg px-3 py-2 text-sm">
                    <span>{participantNameById.get(participantId) ?? participantId}</span>
                    <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <div className="text-xs font-mono uppercase text-muted-foreground inline-flex items-center gap-1">
                  <Timer size={11} /> Round Durations
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {data.roundDurations.map((seconds, index) => (
                    <span key={`${seconds}-${index}`} className="rounded-md bg-muted px-2 py-1 text-xs font-mono">
                      R{index + 1}: {seconds}s
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Replay Timeline</div>
              {replayLoading && <div className="text-sm text-muted-foreground">Loading replay timeline...</div>}
              {!replayLoading && (!replayData || replayData.rounds.length === 0) && (
                <div className="text-sm text-muted-foreground">Replay timeline is not available yet.</div>
              )}
              {!replayLoading && replayData?.rounds.map((round) => (
                <div key={round.round} className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono uppercase text-muted-foreground">
                    <span>Round {round.round}</span>
                    <span>{round.durationSeconds}s</span>
                  </div>

                  {round.questions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No archived questions for this round.</div>
                  ) : (
                    round.questions.map((question, index) => (
                      <div key={`${round.round}-${index}`} className="text-sm border border-border/60 rounded-md px-2 py-1.5">
                        <div className="text-xs text-muted-foreground mb-1">
                          {participantNameById.get(question.participantId) ?? question.participantId}
                        </div>
                        <div>{question.content}</div>
                      </div>
                    ))
                  )}

                  <div className="text-xs text-muted-foreground">
                    Eliminated: {round.eliminatedParticipantIds.length === 0
                      ? "None"
                      : round.eliminatedParticipantIds
                          .map((participantId) => participantNameById.get(participantId) ?? participantId)
                          .join(", ")}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="text-[10px] font-mono uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
    </div>
  );
}
