/**
 * Balance report: AI-vs-AI games across every pair of starter decks.
 * Skipped during normal test runs. Run it with `npm run balance`.
 */
import { it } from 'vitest';
import { chooseAction, chooseMulligan } from './ai';
import { getCard } from './cards';
import { STARTER_DECKS } from './decks';
import { applyAction, createGame } from './game';
import { RIVALS } from './rivals';
import type { PlayerId } from './types';

const GAMES_PER_PAIRING = Number(import.meta.env.GAMES ?? 100);

interface CardStats {
  playedIn: number;
  playedWins: number;
  stuck: number;
  decks: Set<string>;
}

it.skipIf(!import.meta.env.BALANCE)('balance report', () => {
  const deckGames: Record<string, { games: number; wins: number }> = {};
  const matchups: Record<string, number> = {};
  const cards: Record<string, CardStats> = {};
  let totalTurns = 0;
  let games = 0;
  let firstPlayerWins = 0;
  let seed = 1;

  for (const a of STARTER_DECKS) {
    for (const b of STARTER_DECKS) {
      if (a === b) continue;
      for (let g = 0; g < GAMES_PER_PAIRING; g++) {
        const decks = [a, b];
        const state = createGame(
          [
            { name: a.id, deck: a.cards, isAI: true },
            { name: b.id, deck: b.cards, isAI: true },
          ],
          seed++,
        );
        const played: [Set<string>, Set<string>] = [new Set(), new Set()];
        for (const p of [0, 1] as PlayerId[]) applyAction(state, { type: 'mulligan', player: p, redraw: chooseMulligan(state, p) });
        while (state.phase !== 'over') {
          const action = chooseAction(state, state.active);
          if ('handIndex' in action) played[state.active].add(state.players[state.active].hand[action.handIndex]);
          applyAction(state, action);
        }

        games++;
        totalTurns += state.turn / 2;
        if (state.winner === state.firstPlayer) firstPlayerWins++;
        matchups[`${a.id} vs ${b.id}`] = (matchups[`${a.id} vs ${b.id}`] ?? 0) + (state.winner === 0 ? 1 : 0);
        for (const p of [0, 1] as PlayerId[]) {
          const won = state.winner === p;
          const d = (deckGames[decks[p].id] ??= { games: 0, wins: 0 });
          d.games++;
          if (won) d.wins++;
          for (const id of new Set(decks[p].cards)) {
            const s = (cards[id] ??= { playedIn: 0, playedWins: 0, stuck: 0, decks: new Set() });
            s.decks.add(decks[p].id);
          }
          for (const id of played[p]) {
            cards[id].playedIn++;
            if (won) cards[id].playedWins++;
          }
          for (const id of state.players[p].hand) cards[id].stuck++;
        }
      }
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`.padStart(4);
  const deckRate = (id: string) => deckGames[id].wins / deckGames[id].games;

  console.log(`\n${games} games · ${(totalTurns / games).toFixed(1)} turns per player · first player wins ${pct(firstPlayerWins / games)}\n`);
  console.log('DECKS (win rate)');
  for (const d of STARTER_DECKS) console.log(`  ${d.name.padEnd(18)} ${pct(deckRate(d.id))}`);

  console.log('\nMATCHUPS (row deck win rate against column deck, both seats combined)');
  console.log(`  ${''.padEnd(14)}${STARTER_DECKS.map((d) => d.id.padStart(14)).join('')}`);
  for (const a of STARTER_DECKS) {
    const cells = STARTER_DECKS.map((b) => {
      if (a === b) return '—'.padStart(14);
      const w = matchups[`${a.id} vs ${b.id}`] + (GAMES_PER_PAIRING - matchups[`${b.id} vs ${a.id}`]);
      return pct(w / (2 * GAMES_PER_PAIRING)).padStart(14);
    });
    console.log(`  ${a.id.padEnd(14)}${cells.join('')}`);
  }

  // A card's "edge" is how much more often its deck wins when the card gets played,
  // compared with that deck's overall win rate.
  const rows = Object.entries(cards).map(([id, s]) => {
    const baseline = [...s.decks].reduce((sum, d) => sum + deckRate(d), 0) / s.decks.size;
    const winWhenPlayed = s.playedIn ? s.playedWins / s.playedIn : 0;
    const appearances = [...s.decks].reduce((sum, d) => sum + deckGames[d].games, 0);
    return { id, winWhenPlayed, edge: winWhenPlayed - baseline, playRate: s.playedIn / appearances, stuck: s.stuck / appearances };
  });
  rows.sort((x, y) => y.edge - x.edge);
  console.log('\nCARDS (sorted by edge: win rate when played minus its deck win rate)');
  console.log(`  ${'card'.padEnd(20)}${'cost'.padStart(5)}${'edge'.padStart(7)}${'won'.padStart(6)}${'played'.padStart(8)}${'stuck'.padStart(7)}`);
  for (const r of rows) {
    const card = getCard(r.id);
    const edge = `${r.edge >= 0 ? '+' : ''}${(r.edge * 100).toFixed(0)}`;
    console.log(`  ${card.name.padEnd(20)}${String(card.cost).padStart(5)}${edge.padStart(7)}${pct(r.winWhenPlayed).padStart(6)}${pct(r.playRate).padStart(8)}${pct(r.stuck).padStart(7)}`);
  }

  // Rivals play their own decks with their own personalities.
  const rivalWins: Record<string, { games: number; wins: number }> = {};
  for (const a of RIVALS) {
    for (const b of RIVALS) {
      if (a === b) continue;
      const deckA = STARTER_DECKS.find((d) => d.id === a.deckId)!;
      const deckB = STARTER_DECKS.find((d) => d.id === b.deckId)!;
      for (let g = 0; g < GAMES_PER_PAIRING; g++) {
        const state = createGame(
          [
            { name: a.id, deck: deckA.cards, isAI: true },
            { name: b.id, deck: deckB.cards, isAI: true },
          ],
          seed++,
        );
        const profiles = [a.profile, b.profile];
        for (const p of [0, 1] as PlayerId[]) applyAction(state, { type: 'mulligan', player: p, redraw: chooseMulligan(state, p) });
        while (state.phase !== 'over') applyAction(state, chooseAction(state, state.active, profiles[state.active]));
        for (const [i, r] of [a, b].entries()) {
          const w = (rivalWins[r.id] ??= { games: 0, wins: 0 });
          w.games++;
          if (state.winner === i) w.wins++;
        }
      }
    }
  }
  console.log('\nRIVALS (own deck and personality, round robin)');
  for (const r of RIVALS) console.log(`  ${r.name.padEnd(20)} ${pct(rivalWins[r.id].wins / rivalWins[r.id].games)}`);
}, 600_000);
