/**
 * Game constants are the single source of truth for the live matchmaking
 * experience. These values are intentionally lightweight and should only
 * govern timing, round counts, premium boosts, and game session limits.
 *
 * This file must never own matchmaking rules, user state, or domain logic.
 * Those belong in service code or rule helpers.
 */
export const MAX_SUITORS = 5;
export const MIN_SUITORS = 3;
export const MAX_ALLOWED_SUITORS = 6;

/**
 * The baseline number of rounds for a standard game session.
 * Default matches the default max suitors minus one.
 */
export const DEFAULT_NUMBER_OF_ROUNDS = MAX_SUITORS - 1;

/**
 * The round number that represents the final winner selection phase.
 */
export const FINAL_ROUND_NUMBER = DEFAULT_NUMBER_OF_ROUNDS;

/**
 * Default time allotted for asking a question, in seconds.
 */
export const QUESTION_TIME_SECONDS = 30;

/**
 * Default time allotted for answering a question, in seconds.
 */
export const ANSWER_TIME_SECONDS = 15;

/**
 * Default per-round duration in seconds for the chooser/question phase.
 */
export const DEFAULT_ROUND_DURATION_SECONDS = 30;

/**
 * Allowed round counts for sessions (3 or 5)
 */
export const ALLOWED_ROUND_COUNTS = [3, 5] as const;

/**
 * Delay used to separate elimination actions and allow frontend animation.
 */
export const ELIMINATION_DELAY_MS = 2000;

/**
 * Maximum time before a match session is considered stale, in milliseconds.
 */
export const MATCH_TIMEOUT_MS = 180000;

/**
 * Premium score boost applied when ranking suitors during matchmaking.
 */
export const PREMIUM_POOL_BOOST = 0.15;

/**
 * Default number of questions to generate for a round when no round-specific
 * value is provided.
 */
export const DEFAULT_QUESTION_COUNT = 1;
