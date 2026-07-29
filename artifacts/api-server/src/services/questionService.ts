import crypto from "node:crypto";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { db, gameArchivesTable, questionBankTable, type QuestionBankRow } from "@workspace/db";
import { makeId } from "./utils";
import { getQuestionPerformanceSnapshots } from "./questionTelemetryService";

export type QuestionCategory = "general" | "fun" | "deep";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionItem {
  id?: string;
  question: string;
  packSlug?: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
}

export type RoundDifficulty = QuestionDifficulty | "wildcard";

export type QuestionPackStrategy =
  | { mode: "single"; packSlug: string }
  | { mode: "multi"; packSlugs: string[] }
  | { mode: "weighted"; packWeights: Record<string, number> }
  | { mode: "seasonal"; seasonalPackSlugs: string[]; fallbackPackSlugs?: string[] }
  | { mode: "premium"; premiumPackSlugs: string[]; fallbackPackSlugs: string[] };

export type RoomQuestionConfig = {
  packStrategy?: QuestionPackStrategy;
  categoryWeights?: Partial<Record<QuestionCategory, number>>;
  difficultyPlan?: RoundDifficulty[];
  avoidRecentGames?: number;
  disallowRepeatsInGame?: boolean;
};

export type RoundQuestionSelectionContext = {
  roomId: string;
  round: number;
  maxSuitors: number;
  isPremiumRoom?: boolean;
  previouslyUsedQuestionIds?: string[];
  config?: RoomQuestionConfig;
};

export type RoundQuestionSelectionResult = {
  questions: QuestionItem[];
  usedFallback: boolean;
  difficultyApplied: RoundDifficulty;
};

export type QuestionFilterInput = {
  search?: string;
  packSlug?: string;
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

export type CreateQuestionInput = {
  content: string;
  packSlug: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  createdByUserId?: string;
};

export type UpdateQuestionInput = Partial<Pick<CreateQuestionInput, "content" | "packSlug" | "category" | "difficulty">> & {
  isActive?: boolean;
};

const FALLBACK_QUESTIONS: Record<QuestionCategory, QuestionItem[]> = {
  general: [
    { question: "What is one green flag you always notice first?", category: "general", difficulty: "easy" },
    { question: "What is a routine that keeps your week grounded?", category: "general", difficulty: "medium" },
    { question: "What value in a relationship is non-negotiable for you?", category: "general", difficulty: "hard" },
  ],
  fun: [
    { question: "What is your most chaotic but lovable hobby?", category: "fun", difficulty: "easy" },
    { question: "If your life had an opening credits song, what would it be?", category: "fun", difficulty: "medium" },
    { question: "What ridiculous challenge would you dominate on a game show?", category: "fun", difficulty: "medium" },
  ],
  deep: [
    { question: "When do you feel most emotionally safe with someone?", category: "deep", difficulty: "medium" },
    { question: "What changed your idea of love in a lasting way?", category: "deep", difficulty: "hard" },
    { question: "What part of your story do you wish people asked about more?", category: "deep", difficulty: "hard" },
  ],
};

function normalizeQuestionContent(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function toQuestionHash(input: string): string {
  return crypto.createHash("sha256").update(normalizeQuestionContent(input)).digest("hex");
}

function normalizedPackSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "core";
}

function defaultDifficultyPlan(maxSuitors: number): RoundDifficulty[] {
  if (maxSuitors <= 3) return ["easy", "medium", "hard"];
  if (maxSuitors === 4) return ["easy", "easy", "medium", "hard"];
  if (maxSuitors === 5) return ["easy", "easy", "medium", "medium", "hard"];
  return ["easy", "easy", "medium", "medium", "hard", "wildcard"];
}

function resolveRoundDifficulty(round: number, maxSuitors: number, config?: RoomQuestionConfig): RoundDifficulty {
  const plan = config?.difficultyPlan?.length ? config.difficultyPlan : defaultDifficultyPlan(maxSuitors);
  const index = Math.max(0, Math.min(plan.length - 1, round - 1));
  return plan[index] ?? "wildcard";
}

function weightedPick<T>(items: Array<{ value: T; weight: number }>): T | null {
  const sanitized = items.filter((item) => item.weight > 0);
  const total = sanitized.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const item of sanitized) {
    roll -= item.weight;
    if (roll <= 0) return item.value;
  }
  return sanitized[sanitized.length - 1]?.value ?? null;
}

function normalizeCategoryWeights(config?: RoomQuestionConfig): Record<QuestionCategory, number> {
  const raw = config?.categoryWeights ?? {};
  return {
    general: Math.max(0, raw.general ?? 1),
    fun: Math.max(0, raw.fun ?? 1),
    deep: Math.max(0, raw.deep ?? 1),
  };
}

function isPackAllowed(packSlug: string, strategy: QuestionPackStrategy | undefined, isPremiumRoom: boolean): boolean {
  if (!strategy) return true;
  if (strategy.mode === "single") return packSlug === normalizedPackSlug(strategy.packSlug);
  if (strategy.mode === "multi") return strategy.packSlugs.map(normalizedPackSlug).includes(packSlug);
  if (strategy.mode === "weighted") return Object.keys(strategy.packWeights).map(normalizedPackSlug).includes(packSlug);
  if (strategy.mode === "seasonal") {
    const seasonal = strategy.seasonalPackSlugs.map(normalizedPackSlug);
    const fallback = (strategy.fallbackPackSlugs ?? []).map(normalizedPackSlug);
    return seasonal.includes(packSlug) || fallback.includes(packSlug);
  }
  if (strategy.mode === "premium") {
    const premium = strategy.premiumPackSlugs.map(normalizedPackSlug);
    const fallback = strategy.fallbackPackSlugs.map(normalizedPackSlug);
    return isPremiumRoom ? premium.includes(packSlug) || fallback.includes(packSlug) : fallback.includes(packSlug);
  }
  return true;
}

function choosePackByStrategy(strategy: QuestionPackStrategy | undefined, isPremiumRoom: boolean): string | null {
  if (!strategy) return null;
  if (strategy.mode === "single") return normalizedPackSlug(strategy.packSlug);
  if (strategy.mode === "multi") return weightedPick(strategy.packSlugs.map((packSlug) => ({ value: normalizedPackSlug(packSlug), weight: 1 })));
  if (strategy.mode === "weighted") {
    const picks = Object.entries(strategy.packWeights).map(([packSlug, weight]) => ({
      value: normalizedPackSlug(packSlug),
      weight: Math.max(0, weight),
    }));
    return weightedPick(picks);
  }
  if (strategy.mode === "seasonal") {
    const seasonal = strategy.seasonalPackSlugs.map((packSlug) => ({ value: normalizedPackSlug(packSlug), weight: 3 }));
    const fallback = (strategy.fallbackPackSlugs ?? []).map((packSlug) => ({ value: normalizedPackSlug(packSlug), weight: 1 }));
    return weightedPick([...seasonal, ...fallback]);
  }
  const premium = strategy.premiumPackSlugs.map((packSlug) => ({ value: normalizedPackSlug(packSlug), weight: 3 }));
  const fallback = strategy.fallbackPackSlugs.map((packSlug) => ({ value: normalizedPackSlug(packSlug), weight: 1 }));
  return weightedPick(isPremiumRoom ? [...premium, ...fallback] : fallback);
}

async function getRecentlyUsedQuestionHashes(limitGames: number): Promise<Set<string>> {
  if (limitGames <= 0) return new Set();
  const archives = await db
    .select({ questionsAsked: gameArchivesTable.questionsAsked })
    .from(gameArchivesTable)
    .orderBy(desc(gameArchivesTable.completionTimestamp))
    .limit(limitGames);

  const hashes = new Set<string>();
  for (const archive of archives) {
    const questions = Array.isArray(archive.questionsAsked) ? archive.questionsAsked : [];
    for (const question of questions) {
      if (question && typeof question.content === "string") {
        hashes.add(toQuestionHash(question.content));
      }
    }
  }
  return hashes;
}

function targetQuestionCount(round: number, maxSuitors: number): number {
  const finalRound = maxSuitors - 1;
  return round < finalRound ? 1 : Math.min(3, maxSuitors);
}

/**
 * Load a copy of questions for the requested category.
 *
 * @param category - question category to load
 * @returns a shallow copy of the question list
 */
export async function loadQuestions(category?: QuestionCategory, packSlug?: string): Promise<QuestionItem[]> {
  const where = and(
    eq(questionBankTable.isActive, true),
    category ? eq(questionBankTable.category, category) : undefined,
    packSlug ? eq(questionBankTable.packSlug, normalizedPackSlug(packSlug)) : undefined,
  );

  const rows = await db
    .select()
    .from(questionBankTable)
    .where(where)
    .orderBy(asc(questionBankTable.createdAt));

  if (rows.length === 0 && category) {
    return [...FALLBACK_QUESTIONS[category]];
  }

  if (rows.length === 0) {
    return Object.values(FALLBACK_QUESTIONS).flat();
  }

  return rows.map((row) => ({
    id: row.id,
    question: row.content,
    packSlug: row.packSlug,
    category: row.category,
    difficulty: row.difficulty,
  }));
}

/**
 * Shuffle an array deterministically at runtime.
 *
 * This helper is generic so it can be reused for question ordering and
 * any future randomization needs inside the question service.
 *
 * @param items - array to shuffle
 * @returns a new array with items in randomized order
 */
export function shuffleQuestions<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generate the questions for a specific round in a game session.
 *
 * @param round - current round number
 * @param maxSuitors - number of suitors in the game session
 * @param category - optional question category
 * @returns a list of questions for that round
 */
export async function generateRoundQuestions(
  round: number,
  maxSuitors: number,
  category: QuestionCategory = "general",
  packSlug?: string,
): Promise<QuestionItem[]> {
  const questions = await loadQuestions(category, packSlug);
  const count = targetQuestionCount(round, maxSuitors);
  return shuffleQuestions(questions).slice(0, count);
}

export async function selectRoundQuestionsForRoom(
  context: RoundQuestionSelectionContext,
): Promise<RoundQuestionSelectionResult> {
  const selectedPack = choosePackByStrategy(context.config?.packStrategy, Boolean(context.isPremiumRoom));
  const difficultyApplied = resolveRoundDifficulty(context.round, context.maxSuitors, context.config);
  const count = targetQuestionCount(context.round, context.maxSuitors);
  const disallowRepeats = context.config?.disallowRepeatsInGame !== false;
  const usedIds = new Set((context.previouslyUsedQuestionIds ?? []).filter(Boolean));
  const avoidRecentGames = Math.max(0, context.config?.avoidRecentGames ?? 3);
  const recentHashes = await getRecentlyUsedQuestionHashes(avoidRecentGames);
  const categoryWeights = normalizeCategoryWeights(context.config);

  const rows = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.isActive, true))
    .orderBy(asc(questionBankTable.updatedAt));

  const eligible = rows.filter((row) => {
    if (selectedPack && row.packSlug !== selectedPack) return false;
    if (!isPackAllowed(row.packSlug, context.config?.packStrategy, Boolean(context.isPremiumRoom))) return false;
    if (difficultyApplied !== "wildcard" && row.difficulty !== difficultyApplied) return false;
    if (categoryWeights[row.category] <= 0) return false;
    if (disallowRepeats && usedIds.has(row.id)) return false;
    if (recentHashes.has(row.normalizedHash)) return false;
    return true;
  });

  const performanceSnapshots = await getQuestionPerformanceSnapshots(eligible.map((row) => row.id));
  const getRankScore = (row: QuestionBankRow) => performanceSnapshots.get(row.id)?.qualityScore ?? 65;
  const getConfidenceScore = (row: QuestionBankRow) => performanceSnapshots.get(row.id)?.confidenceScore ?? 0;
  const getFreshnessScore = (row: QuestionBankRow) => performanceSnapshots.get(row.id)?.freshnessScore ?? 65;

  const byCategory: Record<QuestionCategory, QuestionBankRow[]> = {
    general: [],
    fun: [],
    deep: [],
  };
  for (const row of eligible) byCategory[row.category].push(row);

  for (const category of Object.keys(byCategory) as QuestionCategory[]) {
    byCategory[category].sort((left, right) => {
      const scoreDelta = getRankScore(right) - getRankScore(left);
      if (scoreDelta !== 0) return scoreDelta;
      const confidenceDelta = getConfidenceScore(right) - getConfidenceScore(left);
      if (confidenceDelta !== 0) return confidenceDelta;
      const freshnessDelta = getFreshnessScore(right) - getFreshnessScore(left);
      if (freshnessDelta !== 0) return freshnessDelta;
      const usageDelta = (left.usageCount ?? 0) - (right.usageCount ?? 0);
      if (usageDelta !== 0) return usageDelta;
      return left.updatedAt.getTime() - right.updatedAt.getTime();
    });
  }

  const picked: QuestionBankRow[] = [];
  const mutableByCategory: Record<QuestionCategory, QuestionBankRow[]> = {
    general: [...byCategory.general],
    fun: [...byCategory.fun],
    deep: [...byCategory.deep],
  };

  while (picked.length < count) {
    const nextCategory = weightedPick([
      { value: "general" as QuestionCategory, weight: categoryWeights.general * Math.max(1, mutableByCategory.general.length) },
      { value: "fun" as QuestionCategory, weight: categoryWeights.fun * Math.max(1, mutableByCategory.fun.length) },
      { value: "deep" as QuestionCategory, weight: categoryWeights.deep * Math.max(1, mutableByCategory.deep.length) },
    ]);

    const bucket = nextCategory ? mutableByCategory[nextCategory] : [];
    if (bucket.length === 0) {
      const fallbackBucket = (["general", "fun", "deep"] as QuestionCategory[]).find((category) => mutableByCategory[category].length > 0);
      if (!fallbackBucket) break;
      const row = mutableByCategory[fallbackBucket].shift()!;
      picked.push(row);
      continue;
    }

    const row = bucket.shift()!;
    picked.push(row);
  }

  if (picked.length === count) {
    const selectedIds = picked.map((row) => row.id).filter((id): id is string => Boolean(id));
    if (selectedIds.length > 0) {
      await Promise.all(
        selectedIds.map((id) =>
          db
            .update(questionBankTable)
            .set({ usageCount: sql`${questionBankTable.usageCount} + 1`, updatedAt: new Date() })
            .where(eq(questionBankTable.id, id)),
        ),
      );
    }

    return {
      questions: picked.map((row) => ({
        id: row.id,
        question: row.content,
        packSlug: row.packSlug,
        category: row.category,
        difficulty: row.difficulty,
      })),
      usedFallback: false,
      difficultyApplied,
    };
  }

  const fallbackQuestions = await generateRoundQuestions(context.round, context.maxSuitors);
  if (fallbackQuestions.length === 0) {
    throw new Error("No questions available for room configuration");
  }

  return {
    questions: fallbackQuestions.slice(0, count),
    usedFallback: true,
    difficultyApplied,
  };
}

export async function listQuestions(filters: QuestionFilterInput = {}): Promise<{ items: QuestionBankRow[]; total: number }> {
  const limit = Math.max(1, Math.min(100, filters.limit ?? 25));
  const offset = Math.max(0, filters.offset ?? 0);

  const where = and(
    typeof filters.isActive === "boolean" ? eq(questionBankTable.isActive, filters.isActive) : undefined,
    filters.packSlug ? eq(questionBankTable.packSlug, normalizedPackSlug(filters.packSlug)) : undefined,
    filters.category ? eq(questionBankTable.category, filters.category) : undefined,
    filters.difficulty ? eq(questionBankTable.difficulty, filters.difficulty) : undefined,
    filters.search ? ilike(questionBankTable.content, `%${filters.search.trim()}%`) : undefined,
  );

  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(questionBankTable)
      .where(where)
      .orderBy(desc(questionBankTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(questionBankTable)
      .where(where),
  ]);

  return {
    items,
    total: Number(totalRows[0]?.total ?? 0),
  };
}

export async function createQuestion(input: CreateQuestionInput): Promise<QuestionBankRow> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Question content is required");
  }

  const normalizedHash = toQuestionHash(content);
  const existing = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.normalizedHash, normalizedHash))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    throw new Error("Duplicate question content");
  }

  const id = makeId();
  const now = new Date();
  await db.insert(questionBankTable).values({
    id,
    content,
    packSlug: normalizedPackSlug(input.packSlug),
    category: input.category,
    difficulty: input.difficulty,
    normalizedHash,
    createdByUserId: input.createdByUserId,
    createdAt: now,
    updatedAt: now,
  });

  const row = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!row) {
    throw new Error("Failed to create question");
  }

  return row;
}

export async function updateQuestion(id: string, patch: UpdateQuestionInput): Promise<QuestionBankRow> {
  const existing = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    throw new Error("Question not found");
  }

  const content = patch.content?.trim();
  const nextHash = content ? toQuestionHash(content) : existing.normalizedHash;

  if (content && nextHash !== existing.normalizedHash) {
    const duplicate = await db
      .select()
      .from(questionBankTable)
      .where(eq(questionBankTable.normalizedHash, nextHash))
      .limit(1)
      .then((rows) => rows[0]);

    if (duplicate) {
      throw new Error("Duplicate question content");
    }
  }

  await db
    .update(questionBankTable)
    .set({
      content: content ?? existing.content,
      packSlug: patch.packSlug ? normalizedPackSlug(patch.packSlug) : existing.packSlug,
      category: patch.category ?? existing.category,
      difficulty: patch.difficulty ?? existing.difficulty,
      normalizedHash: nextHash,
      isActive: typeof patch.isActive === "boolean" ? patch.isActive : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(questionBankTable.id, id));

  const updated = await db
    .select()
    .from(questionBankTable)
    .where(eq(questionBankTable.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!updated) {
    throw new Error("Failed to update question");
  }

  return updated;
}

export async function archiveQuestion(id: string): Promise<QuestionBankRow> {
  return updateQuestion(id, { isActive: false });
}

export async function listQuestionPacks(): Promise<Array<{ packSlug: string; total: number; active: number }>> {
  const rows = await db
    .select({
      packSlug: questionBankTable.packSlug,
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${questionBankTable.isActive} = true)`,
    })
    .from(questionBankTable)
    .groupBy(questionBankTable.packSlug)
    .orderBy(asc(questionBankTable.packSlug));

  return rows.map((row) => ({
    packSlug: row.packSlug,
    total: Number(row.total ?? 0),
    active: Number(row.active ?? 0),
  }));
}
