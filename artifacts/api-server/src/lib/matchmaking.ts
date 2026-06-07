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

export function rankSuitors<T extends { personalityVector: number[] }>(
  chooserVector: number[],
  suitors: T[],
  topN: number,
): T[] {
  const scored = suitors.map((s) => ({
    suitor: s,
    score: cosineSimilarity(chooserVector, s.personalityVector),
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });
  return scored.slice(0, topN).map((s) => s.suitor);
}
