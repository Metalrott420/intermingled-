import { useState } from "react";
import { Button } from "@/components/ui/button";

type QuestionRatingSummary = {
  questionId: string;
  ratingCount: number;
  averageRating: number | null;
  qualityScore: number | null;
};

type QuestionItem = {
  id: string;
  content: string;
  packSlug?: string;
  category: string;
  difficulty: string;
  ratingSummary?: QuestionRatingSummary;
};

export function QuestionRatingPanel({
  roomId,
  participantId,
  questions,
  authToken,
}: {
  roomId: string;
  participantId: string | null;
  questions: QuestionItem[];
  authToken?: string | null;
}) {
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);
  const [submittedRatings, setSubmittedRatings] = useState<Record<string, number>>({});

  if (questions.length === 0) {
    return null;
  }

  const submitRating = async (questionId: string, rating: number) => {
    setPendingQuestionId(questionId);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      await fetch(`/api/rooms/${roomId}/questions/${questionId}/rating`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating, participantId }),
      });
      setSubmittedRatings((current) => ({ ...current, [questionId]: rating }));
    } finally {
      setPendingQuestionId(null);
    }
  };

  return (
    <section className="px-3 sm:px-4 py-3 border-b border-border/60 bg-background/70 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">Question feedback</div>
          <div className="text-sm font-display font-black uppercase tracking-wide">Rate the current prompts</div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
          Live quality scoring
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((question) => {
          const isSubmitted = submittedRatings[question.id];
          const summary = question.ratingSummary;
          return (
            <article key={question.id} className="rounded-xl border border-border/70 bg-card/70 p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {question.packSlug ?? "core"} · {question.category} · {question.difficulty}
                </div>
                <div className="text-sm leading-relaxed text-foreground/90">{question.content}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={isSubmitted === rating ? "default" : "outline"}
                    className="h-8 px-3 text-xs font-black uppercase tracking-widest"
                    onClick={() => void submitRating(question.id, rating)}
                    disabled={pendingQuestionId === question.id}
                  >
                    {rating}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>
                  {summary?.ratingCount ? `${summary.ratingCount} rating${summary.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
                </span>
                <span>
                  {summary?.averageRating != null
                    ? `avg ${summary.averageRating.toFixed(1)} · score ${summary.qualityScore ?? 0}`
                    : "Awaiting score"}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
