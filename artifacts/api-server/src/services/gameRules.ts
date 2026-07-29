/**
 * GameRulesContext captures the policy inputs used by the game rule engine.
 *
 * This file contains permissions and eligibility checks only. It must never
 * implement persistence, user identity, or transport-level behavior.
 */
import { GameState } from "./gameState";

export interface GameRulesContext {
  isPremium?: boolean;
  hasKeys?: boolean;
  isAdmin?: boolean;
  currentState?: GameState;
}

/**
 * Determines whether the user may begin a chooser session.
 *
 * @param context - current membership and entitlement context
 */
export function canBecomeChooser(context: GameRulesContext): boolean {
  return true;
}

/**
 * Determines whether the user may join a game session as a player.
 *
 * @param context - current membership and entitlement context
 */
export function canJoinGame(context: GameRulesContext): boolean {
  return true;
}

/**
 * Determines whether the current user may use membership keys.
 *
 * @param context - current membership and entitlement context
 */
export function canUseKeys(context: GameRulesContext): boolean {
  return context.isPremium === true || context.hasKeys === true;
}

/**
 * Determines whether the user may create a five-round game session.
 *
 * @param context - current membership and entitlement context
 */
export function canCreateFiveRoundGame(context: GameRulesContext): boolean {
  return context.isPremium === true || context.isAdmin === true;
}

/**
 * Determines whether the user may create a private game session.
 *
 * @param context - current membership and entitlement context
 */
export function canCreatePrivateGame(context: GameRulesContext): boolean {
  return context.isPremium === true || context.isAdmin === true;
}

/**
 * Determines whether the user may enter a spectator mode.
 *
 * @param context - current membership and entitlement context
 */
export function canSpectate(context: GameRulesContext): boolean {
  return true;
}
