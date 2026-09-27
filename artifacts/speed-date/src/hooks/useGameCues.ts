import { useCallback } from "react";

export type GameCue = "countdown_tick" | "elimination_stinger" | "winner_fanfare" | "match_confirmed";

function dispatchCue(cue: GameCue) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("intermingled:game-cue", { detail: { cue } }));
}

export function useGameCues() {
  const playCue = useCallback((cue: GameCue) => {
    dispatchCue(cue);
  }, []);

  return {
    playCountdownTick: useCallback(() => playCue("countdown_tick"), [playCue]),
    playEliminationStinger: useCallback(() => playCue("elimination_stinger"), [playCue]),
    playWinnerFanfare: useCallback(() => playCue("winner_fanfare"), [playCue]),
    playMatchConfirmed: useCallback(() => playCue("match_confirmed"), [playCue]),
  };
}
