import { describe, expect, it } from 'vitest';
import { chooseAction, chooseMulligan } from './ai';
import { deckProblems, deckWarnings, STARTER_DECKS } from './decks';
import { CRYSTAL_HP } from './rules';
import { applyAction, attackTargets, createGame, power, spawnCreature, validate } from './game';
import type { GameState, PlayerId } from './types';

/** A game past the mulligan, on turn 3 with player 0 active and plenty of energy. */
function setup(): GameState {
  const state = createGame(
    [
      { name: 'Alice', deck: STARTER_DECKS[0].cards, isAI: false },
      { name: 'Bob', deck: STARTER_DECKS[3].cards, isAI: false },
    ],
    42,
  );
  state.phase = 'main';
  state.active = 0;
  state.firstPlayer = 0;
  state.turn = 3;
  for (const p of state.players) {
    p.mulliganDone = true;
    p.turnsTaken = 2;
    p.energy = 10;
    p.hand = [];
  }
  return state;
}

/** Spawn a creature that was played on an earlier turn, so it can attack. */
function ready(state: GameState, player: PlayerId, lane: 0 | 1 | 2, cardId: string, buff = 0) {
  const c = spawnCreature(state, player, lane, cardId);
  c.playedTurn = 1;
  c.buff = buff;
  return c;
}

describe('combat', () => {
  it('overflows front → back → crystal, and only the front creature retaliates', () => {
    const state = setup();
    const attacker = ready(state, 0, 0, 'great-bear'); // PL 8
    ready(state, 1, 0, 'footman', 2); // PL 5
    ready(state, 1, 0, 'ember-wisp'); // PL 2
    applyAction(state, { type: 'attack', lane: 0, row: 'front', targetLane: 0 });

    const enemy = state.players[1].lanes[0];
    expect(enemy.front).toBeNull();
    expect(enemy.back).toBeNull();
    expect(enemy.crystal).toBe(CRYSTAL_HP - 1);
    expect(power(attacker)).toBe(3);
  });

  it('ranged attackers take no retaliation', () => {
    const state = setup();
    ready(state, 0, 1, 'footman');
    const archer = ready(state, 0, 1, 'crossbowman'); // back row, PL 2
    const target = ready(state, 1, 1, 'great-bear'); // PL 8
    applyAction(state, { type: 'attack', lane: 1, row: 'back', targetLane: 1 });
    expect(power(target)).toBe(6);
    expect(power(archer)).toBe(2);
  });

  it('back-row creatures without Ranged cannot attack', () => {
    const state = setup();
    ready(state, 0, 1, 'footman');
    ready(state, 0, 1, 'great-bear');
    expect(attackTargets(state, 0, 1, 'back')).toEqual([]);
  });

  it('Shield blocks the first hit completely', () => {
    const state = setup();
    ready(state, 0, 2, 'great-bear');
    const golem = ready(state, 1, 2, 'stone-golem'); // PL 3, Shield
    applyAction(state, { type: 'attack', lane: 2, row: 'front', targetLane: 2 });
    expect(power(golem)).toBe(3);
    expect(golem.shield).toBe(false);
    expect(state.players[1].lanes[2].crystal).toBe(CRYSTAL_HP);
  });

  it('First Strike takes no retaliation when it destroys the defender', () => {
    const state = setup();
    const captain = ready(state, 0, 0, 'knight-captain'); // PL 6
    ready(state, 1, 0, 'boar'); // PL 3
    applyAction(state, { type: 'attack', lane: 0, row: 'front', targetLane: 0 });
    expect(power(captain)).toBe(6);
  });

  it('ranged attackers in the front row still take retaliation', () => {
    const state = setup();
    const archer = ready(state, 0, 1, 'crossbowman'); // front row, PL 2
    ready(state, 1, 1, 'boar'); // PL 4
    applyAction(state, { type: 'attack', lane: 1, row: 'front', targetLane: 1 });
    expect(archer.damage).toBe(2);
    expect(state.players[0].lanes[1].front).toBeNull();
  });

  it('creatures cannot attack the turn they are played unless they have Rush', () => {
    const state = setup();
    spawnCreature(state, 0, 0, 'footman');
    spawnCreature(state, 0, 1, 'wolf');
    expect(attackTargets(state, 0, 0, 'front')).toEqual([]);
    expect(attackTargets(state, 0, 1, 'front')).toEqual([1]);
  });

  it('the first player cannot attack on their first turn', () => {
    const state = setup();
    state.players[0].turnsTaken = 1;
    ready(state, 0, 0, 'wolf');
    expect(attackTargets(state, 0, 0, 'front')).toEqual([]);
  });
});

describe('evolution', () => {
  it('can evolve a creature the turn it is played, but only once per turn', () => {
    const state = setup();
    spawnCreature(state, 0, 0, 'goblin-grunt');
    state.players[0].hand = ['goblin-chief', 'goblin-warlord'];
    applyAction(state, { type: 'evolve', handIndex: 0, lane: 0, row: 'front' });
    expect(state.players[0].lanes[0].front!.cardId).toBe('goblin-chief');
    expect(validate(state, { type: 'evolve', handIndex: 0, lane: 0, row: 'front' })).not.toBeNull();
  });

  it('keeps damage when evolving', () => {
    const state = setup();
    const grunt = ready(state, 0, 0, 'goblin-grunt');
    grunt.damage = 1;
    state.players[0].hand = ['goblin-chief'];
    applyAction(state, { type: 'evolve', handIndex: 0, lane: 0, row: 'front' });
    expect(grunt.cardId).toBe('goblin-chief');
    expect(power(grunt)).toBe(5);
  });

  it('only evolves from the matching type and star level', () => {
    const state = setup();
    ready(state, 0, 0, 'wolf');
    state.players[0].hand = ['goblin-chief', 'goblin-warlord'];
    expect(validate(state, { type: 'evolve', handIndex: 0, lane: 0, row: 'front' })).not.toBeNull();
    expect(validate(state, { type: 'playCreature', handIndex: 1, lane: 1 })).not.toBeNull();
  });
});

describe('crystals and winning', () => {
  it('fatigue damages the weakest crystal, increasing each time', () => {
    const state = setup();
    state.players[1].deck = [];
    state.players[1].lanes[2].crystal = 10;
    applyAction(state, { type: 'endTurn' });
    expect(state.players[1].lanes[2].crystal).toBe(9);
    applyAction(state, { type: 'endTurn' });
    applyAction(state, { type: 'endTurn' });
    expect(state.players[1].lanes[2].crystal).toBe(7);
  });

  it('creatures can still be played in a lane whose crystal is destroyed, and must be attacked first', () => {
    const state = setup();
    ready(state, 0, 0, 'great-bear');
    state.players[1].lanes[0].destroyed = true;
    state.players[1].lanes[0].crystal = 0;
    expect(attackTargets(state, 0, 0, 'front')).toEqual([1]);

    state.players[1].hand = ['footman'];
    applyAction(state, { type: 'endTurn' });
    applyAction(state, { type: 'playCreature', handIndex: state.players[1].hand.indexOf('footman'), lane: 0 });
    applyAction(state, { type: 'endTurn' });
    expect(attackTargets(state, 0, 0, 'front')).toEqual([0]);
  });

  it('a destroyed crystal with an empty lane lets attackers hit an adjacent lane', () => {
    const state = setup();
    ready(state, 0, 0, 'great-bear');
    state.players[1].lanes[0].crystal = 5;
    applyAction(state, { type: 'attack', lane: 0, row: 'front', targetLane: 0 });
    expect(state.players[1].lanes[0].destroyed).toBe(true);

    applyAction(state, { type: 'endTurn' });
    applyAction(state, { type: 'endTurn' });
    expect(attackTargets(state, 0, 0, 'front')).toEqual([1]);
  });

  it('destroying 2 crystals wins the game', () => {
    const state = setup();
    ready(state, 0, 0, 'great-bear');
    ready(state, 0, 1, 'great-bear');
    state.players[1].lanes[0].crystal = 1;
    state.players[1].lanes[1].crystal = 1;
    applyAction(state, { type: 'attack', lane: 0, row: 'front', targetLane: 0 });
    expect(state.winner).toBeNull();
    applyAction(state, { type: 'attack', lane: 1, row: 'front', targetLane: 1 });
    expect(state.winner).toBe(0);
    expect(state.phase).toBe('over');
  });
});

describe('traps', () => {
  it('Smoke Screen cancels the attack', () => {
    const state = setup();
    ready(state, 0, 0, 'great-bear');
    state.players[1].lanes[0].trap = { cardId: 'smoke-screen', setTurn: 2 };
    applyAction(state, { type: 'attack', lane: 0, row: 'front', targetLane: 0 });
    expect(state.players[1].lanes[0].crystal).toBe(CRYSTAL_HP);
    expect(state.players[1].lanes[0].trap).toBeNull();
  });

  it('Ambush destroys a weak creature when it is played', () => {
    const state = setup();
    state.players[1].lanes[1].trap = { cardId: 'ambush', setTurn: 2 };
    state.players[0].hand = ['footman'];
    applyAction(state, { type: 'playCreature', handIndex: 0, lane: 1 });
    expect(state.players[0].lanes[1].front).toBeNull();
  });
});

describe('AI', () => {
  it('plays complete games against itself without errors', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const a = STARTER_DECKS[seed % STARTER_DECKS.length];
      const b = STARTER_DECKS[(seed + 2) % STARTER_DECKS.length];
      const state = createGame(
        [
          { name: a.name, deck: a.cards, isAI: true },
          { name: b.name, deck: b.cards, isAI: true },
        ],
        seed,
      );
      for (const player of [0, 1] as PlayerId[]) {
        applyAction(state, { type: 'mulligan', player, redraw: chooseMulligan(state, player) });
      }
      let steps = 0;
      while (state.phase !== 'over') {
        applyAction(state, chooseAction(state, state.active));
        if (++steps > 5000) throw new Error(`Game ${seed} did not finish`);
      }
      expect(state.winner).not.toBeNull();
    }
  });
});

describe('deck rules', () => {
  it('accepts every starter deck', () => {
    for (const deck of STARTER_DECKS) expect(deckProblems(deck.cards)).toEqual([]);
  });

  it('needs exactly 30 cards and respects copy limits', () => {
    const deck = [...STARTER_DECKS[0].cards];
    expect(deckProblems(deck.slice(1))).toHaveLength(1);
    deck[0] = 'king-grubnak'; // the deck already has one legendary Grubnak
    expect(deckProblems(deck).some((p) => p.includes('King Grubnak'))).toBe(true);
  });

  it('warns about evolutions with nothing to evolve from', () => {
    expect(deckWarnings(['goblin-chief'])).toHaveLength(1);
    expect(deckWarnings(['goblin-grunt', 'goblin-chief'])).toEqual([]);
  });
});
