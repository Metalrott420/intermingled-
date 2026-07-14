export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Boost applied to premium suitors' raw cosine-similarity score.
 * Keeps premium users near the top of the selection without overriding a
 * strongly compatible free-tier suitor — cosine similarity is bounded [0,1],
 * so 0.15 is meaningful but not absolute.
 */
export const PREMIUM_POOL_BOOST = 0.15;

export function rankSuitors<T extends { personalityVector: number[]; isPremium?: boolean }>(
  chooserVector: number[],
  suitors: T[],
  topN: number,
): T[] {
  const scored = suitors.map((s) => ({
    suitor: s,
    score:
      cosineSimilarity(chooserVector, s.personalityVector) +
      (s.isPremium ? PREMIUM_POOL_BOOST : 0),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });
  return scored.slice(0, topN).map((s) => s.suitor);
}
