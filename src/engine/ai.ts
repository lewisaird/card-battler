import { creatureCard, getCard, isDirectlyPlayable } from './cards';
import { applyAction, getLegalActions, keywordsOf, LANES, other, power, ROWS, synergyActive } from './game';
import type { Action, GameState, PlayerId } from './types';

/** How a rival weighs its options. 1 is neutral for the multipliers. */
export interface AIProfile {
  /** How much it values damaging enemy crystals and threatening them. */
  aggression: number;
  /** How much it values protecting its own crystals. */
  caution: number;
  /** Value of each card held in hand. */
  greed: number;
  /** Value of each trap and relic on the board. */
  setup: number;
  /** Random noise added to each option's score: higher means wilder, riskier plays. */
  recklessness: number;
}

export const DEFAULT_PROFILE: AIProfile = { aggression: 1, caution: 1, greed: 0.8, setup: 2, recklessness: 0 };

/**
 * A simple greedy AI: try every legal action on a copy of the game, score the result,
 * and take the best one if it improves on ending the turn. It plays cards before attacking,
 * because attacking ends the main phase.
 */
export function chooseAction(state: GameState, me: PlayerId, profile: AIProfile = DEFAULT_PROFILE): Action {
  const legal = getLegalActions(state);
  const mainActions = legal.filter((a) => a.type !== 'attack' && a.type !== 'endTurn' && a.type !== 'move');
  const attacks = legal.filter((a) => a.type === 'attack');
  const baseline = evaluate(hiddenCopy(state, me), me, profile);

  for (const group of [mainActions, attacks]) {
    let best: Action | null = null;
    let bestScore = baseline + 0.01;
    for (const action of group) {
      const sim = hiddenCopy(state, me);
      applyAction(sim, action);
      const score = evaluate(sim, me, profile) + Math.random() * profile.recklessness;
      if (score > bestScore) {
        best = action;
        bestScore = score;
      }
    }
    if (best) return best;
  }
  return { type: 'endTurn' };
}

/** Keep the opening hand if it has a cheap creature to play. */
export function chooseMulligan(state: GameState, me: PlayerId): boolean {
  const hasEarlyPlay = state.players[me].hand.some((id) => {
    const card = getCard(id);
    return card.kind === 'creature' && isDirectlyPlayable(card) && card.cost <= 2;
  });
  return !hasEarlyPlay;
}

/** A copy for simulation, without the log and events and without the opponent's hidden traps. */
function hiddenCopy(state: GameState, me: PlayerId): GameState {
  const copy = structuredClone({ ...state, log: [], events: [] });
  for (const side of copy.players[other(me)].lanes) side.trap = null;
  return copy;
}

function evaluate(state: GameState, me: PlayerId, profile: AIProfile): number {
  if (state.winner === me) return 1e6;
  if (state.winner !== null) return -1e6;
  // My crystals are weighted by caution and my threats by aggression; the reverse for the enemy.
  return sideScore(state, me, profile.caution, profile.aggression, profile) - sideScore(state, other(me), profile.aggression, profile.caution, profile);
}

function sideScore(state: GameState, player: PlayerId, crystalWeight: number, pressureWeight: number, profile: AIProfile): number {
  const p = state.players[player];
  const enemy = state.players[other(player)];
  let score = p.hand.length * profile.greed;

  for (const lane of LANES) {
    const side = p.lanes[lane];
    if (side.destroyed) score -= 40 * crystalWeight;
    else score += side.crystal * 1.2 * crystalWeight;
    if (side.trap) score += profile.setup;
    if (side.relic) score += profile.setup;

    for (const row of ROWS) {
      const c = side[row];
      if (!c) continue;
      score += power(c) + keywordsOf(c).length * 0.5 + (c.shield ? 1 : 0) + (c.equipment ? 0.5 : 0);
      if (synergyActive(side, row)) score += 1;
      const card = creatureCard(c.cardId);
      if (card.ability?.trigger === 'startOfTurn') score += 1;
    }

    // Pressure: an unblocked creature threatens the enemy crystal opposite it.
    const enemySide = enemy.lanes[lane];
    if (side.front && !enemySide.destroyed && !enemySide.front) score += power(side.front) * 0.6 * pressureWeight;
  }
  return score;
}
