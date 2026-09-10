/**
 * GameState defines the canonical lifecycle states for a live game session.
 *
 * The service layer should use these signals to enforce valid transitions and
 * avoid scattered round-based conditionals in route or socket logic.
 */
export enum GameState {
  WAITING = "waiting",
  COUNTDOWN = "countdown",
  ROUND_ONE = "round_one",
  ROUND_TWO = "round_two",
  ROUND_THREE = "round_three",
  ROUND_FOUR = "round_four",
  ROUND_FIVE = "round_five",
  FINAL_SELECTION = "final_selection",
  MATCH_CREATED = "match_created",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/**
 * Map persisted room status and round number into an explicit game state.
 *
 * This helper is intentionally narrow: it does not mutate data, it only
 * interprets current values into the service-level state machine.
 *
 * @param status - persisted room status from the database
 * @param currentRound - current round number from the database
 * @returns the derived GameState
 */
export function getGameState(status: string, currentRound: number): GameState {
  if (status === "waiting") return GameState.WAITING;
  if (status === "ended") return GameState.COMPLETED;

  switch (currentRound) {
    case 1:
      return GameState.ROUND_ONE;
    case 2:
      return GameState.ROUND_TWO;
    case 3:
      return GameState.ROUND_THREE;
    case 4:
      return GameState.FINAL_SELECTION;
    case 5:
      return GameState.ROUND_FIVE;
    default:
      return GameState.COUNTDOWN;
  }
}

/**
 * Returns true if the provided state represents the final chooser winner
 * selection phase.
 *
 * @param state - current game state
 * @returns true when the game is in final selection
 */
export function isFinalSelection(state: GameState): boolean {
  return state === GameState.FINAL_SELECTION;
}
