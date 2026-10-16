import { creatureCard, getCard, isDirectlyPlayable } from './cards';
import {
  COMPLEMENT,
  CRYSTAL_HP,
  CRYSTALS_TO_WIN,
  HAND_LIMIT,
  LANE_NAMES,
  MAX_ENERGY,
  MOVE_COST,
  STARTING_HAND,
} from './rules';
import type {
  Action,
  AutoEffect,
  Creature,
  GameState,
  Keyword,
  LaneIndex,
  LaneSide,
  PlayerId,
  PlayerState,
  Row,
  Synergy,
  Target,
} from './types';

export const LANES: LaneIndex[] = [0, 1, 2];
export const ROWS: Row[] = ['front', 'back'];

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
export const laneName = (lane: number) => LANE_NAMES[lane];
const otherRow = (row: Row): Row => (row === 'front' ? 'back' : 'front');
const adjacentLanes = (lane: LaneIndex): LaneIndex[] => LANES.filter((l) => Math.abs(l - lane) === 1);

function log(state: GameState, message: string) {
  state.log.push(message);
}

// ---------- Random numbers (seeded, so games can be replayed and tested) ----------

function random(state: GameState): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(state: GameState, items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

// ---------- Creature helpers ----------

export function power(c: Creature): number {
  return c.basePower + c.buff - c.damage;
}

export function keywordsOf(c: Creature): Keyword[] {
  return [...new Set([...creatureCard(c.cardId).keywords, ...c.granted])];
}

export function hasKeyword(c: Creature, k: Keyword): boolean {
  return keywordsOf(c).includes(k);
}

export function synergyActive(side: LaneSide, row: Row): boolean {
  const c = side[row];
  const partner = side[otherRow(row)];
  if (!c || !partner) return false;
  const card = creatureCard(c.cardId);
  if (!card.synergy) return false;
  const partnerType = creatureCard(partner.cardId).type;
  return partnerType === card.type || partnerType === COMPLEMENT[card.type];
}

function synergyAmount(side: LaneSide, row: Row, kind: Synergy['kind']): number {
  const c = side[row];
  if (!c || !synergyActive(side, row)) return 0;
  const synergy = creatureCard(c.cardId).synergy!;
  return synergy.kind === kind ? synergy.amount : 0;
}

function laneRelicAmount(side: LaneSide, type: 'laneStrike' | 'laneRegen'): number {
  if (!side.relic) return 0;
  const relic = getCard(side.relic);
  return relic.kind === 'relic' && relic.effect.type === type ? relic.effect.amount : 0;
}

export function locate(state: GameState, uid: number): { player: PlayerId; lane: LaneIndex; row: Row } | null {
  for (const player of [0, 1] as PlayerId[]) {
    for (const lane of LANES) {
      for (const row of ROWS) {
        if (state.players[player].lanes[lane][row]?.uid === uid) return { player, lane, row };
      }
    }
  }
  return null;
}

/**
 * Stances: a creature that attacked on its owner's most recent turn is Exposed until its owner's
 * next turn begins, so attackers strike it first. Every other creature is Guarding and strikes first.
 */
export function isExposed(state: GameState, owner: PlayerId, c: Creature): boolean {
  const ownersLastTurn = state.active === owner ? state.turn : state.turn - 1;
  return c.attackedTurn === ownersLastTurn;
}

function heal(c: Creature, amount: number) {
  c.damage = Math.max(0, c.damage - amount);
}

/** Place a new creature in a lane: front if empty, otherwise back. Also used by tests. */
export function spawnCreature(state: GameState, player: PlayerId, lane: LaneIndex, cardId: string): Creature {
  const card = creatureCard(cardId);
  const side = state.players[player].lanes[lane];
  const c: Creature = {
    uid: state.nextUid++,
    cardId,
    basePower: card.power,
    buff: 0,
    damage: 0,
    granted: [],
    shield: card.keywords.includes('Shield'),
    playedTurn: state.turn,
    evolvedTurn: -1,
    movedTurn: -1,
    attackedTurn: -1,
    equipment: null,
    stack: [],
  };
  if (!side.front) side.front = c;
  else if (!side.back) side.back = c;
  else throw new Error('Lane is full');
  return c;
}

// ---------- Setup ----------

export interface PlayerSetup {
  name: string;
  deck: string[];
  isAI: boolean;
}

function makeLane(): LaneSide {
  return { front: null, back: null, trap: null, relic: null, crystal: CRYSTAL_HP, destroyed: false };
}

function makePlayer(setup: PlayerSetup): PlayerState {
  return {
    name: setup.name,
    isAI: setup.isAI,
    deck: [...setup.deck],
    hand: [],
    discard: [],
    lanes: [makeLane(), makeLane(), makeLane()],
    energy: 0,
    maxEnergy: 0,
    turnsTaken: 0,
    fatigue: 0,
    mulliganDone: false,
  };
}

export function createGame(setups: [PlayerSetup, PlayerSetup], seed = Date.now()): GameState {
  const state: GameState = {
    players: [makePlayer(setups[0]), makePlayer(setups[1])],
    active: 0,
    firstPlayer: 0,
    turn: 0,
    phase: 'mulligan',
    winner: null,
    log: [],
    events: [],
    rng: seed | 0,
    nextUid: 1,
  };
  for (const player of [0, 1] as PlayerId[]) {
    shuffle(state, state.players[player].deck);
    for (let i = 0; i < STARTING_HAND; i++) drawCard(state, player);
  }
  state.firstPlayer = random(state) < 0.5 ? 0 : 1;
  state.active = state.firstPlayer;
  log(state, `Coin flip: ${state.players[state.firstPlayer].name} goes first.`);
  return state;
}

// ---------- Drawing and fatigue ----------

function drawCard(state: GameState, player: PlayerId) {
  const p = state.players[player];
  const cardId = p.deck.pop();
  if (!cardId) {
    p.fatigue++;
    const lanes = LANES.filter((l) => !p.lanes[l].destroyed);
    const weakest = lanes.reduce((a, b) => (p.lanes[b].crystal < p.lanes[a].crystal ? b : a));
    log(state, `${p.name}'s deck is empty! Fatigue deals ${p.fatigue} to their ${laneName(weakest)} crystal.`);
    damageCrystal(state, player, weakest, p.fatigue);
    return;
  }
  if (p.hand.length >= HAND_LIMIT) {
    p.discard.push(cardId);
    log(state, `${p.name}'s hand is full. ${getCard(cardId).name} is discarded.`);
    return;
  }
  p.hand.push(cardId);
}

// ---------- Damage ----------

/** Damages the creature in a slot. Returns the damage left over (overflow). */
function damageCreatureAt(state: GameState, player: PlayerId, lane: LaneIndex, row: Row, amount: number): number {
  const side = state.players[player].lanes[lane];
  const c = side[row];
  if (!c || power(c) <= 0 || amount <= 0) return amount;
  const name = creatureCard(c.cardId).name;
  if (c.shield) {
    c.shield = false;
    log(state, `${name}'s Shield blocks the hit.`);
    state.events.push({ type: 'blocked', player, lane, row });
    return 0;
  }
  const effective = Math.max(0, amount - synergyAmount(side, row, 'guard'));
  const dealt = Math.min(effective, power(c));
  c.damage += dealt;
  if (dealt > 0) state.events.push({ type: 'damage', player, lane, target: row, amount: dealt });
  log(state, `${name} takes ${dealt} damage${power(c) <= 0 ? ' and is destroyed' : ` (PL ${power(c)})`}.`);
  return effective - dealt;
}

/**
 * Damage flows front creature → back creature → crystal. Pierce skips the back creature.
 * Overflow into a destroyed crystal is lost.
 */
function damageLane(state: GameState, player: PlayerId, lane: LaneIndex, amount: number, pierce = false) {
  let remaining = damageCreatureAt(state, player, lane, 'front', amount);
  if (!pierce) remaining = damageCreatureAt(state, player, lane, 'back', remaining);
  if (remaining > 0) damageCrystal(state, player, lane, remaining);
}

function damageCrystal(state: GameState, player: PlayerId, lane: LaneIndex, amount: number) {
  const side = state.players[player].lanes[lane];
  if (side.destroyed || amount <= 0) return;
  side.crystal = Math.max(0, side.crystal - amount);
  state.events.push({ type: 'damage', player, lane, target: 'crystal', amount });
  log(state, `${state.players[player].name}'s ${laneName(lane)} crystal takes ${amount} (${side.crystal} left).`);
  if (side.crystal === 0) destroyCrystal(state, player, lane);
}

function healCrystal(state: GameState, player: PlayerId, lane: LaneIndex, amount: number) {
  const side = state.players[player].lanes[lane];
  if (side.destroyed) return;
  side.crystal = Math.min(CRYSTAL_HP, side.crystal + amount);
}

function discardCreature(p: PlayerState, c: Creature) {
  p.discard.push(...c.stack, c.cardId);
  if (c.equipment) p.discard.push(c.equipment);
}

function destroyCrystal(state: GameState, player: PlayerId, lane: LaneIndex) {
  const p = state.players[player];
  const side = p.lanes[lane];
  side.destroyed = true;
  log(state, `💥 ${p.name}'s ${laneName(lane)} crystal is destroyed!`);
  state.events.push({ type: 'crystalDestroyed', player, lane });
  checkWinner(state);
}

function checkWinner(state: GameState) {
  if (state.winner !== null) return;
  const lost = state.players.map((p) => p.lanes.filter((l) => l.destroyed).length >= CRYSTALS_TO_WIN);
  if (!lost[0] && !lost[1]) return;
  state.winner = lost[0] && lost[1] ? state.active : lost[0] ? 1 : 0;
  state.phase = 'over';
  log(state, `🏆 ${state.players[state.winner].name} wins!`);
  state.events.push({ type: 'win', player: state.winner });
}

/** Removes destroyed creatures, resolves "when destroyed" abilities and moves back creatures up. */
function cleanup(state: GameState) {
  let changed = true;
  while (changed) {
    changed = false;
    const deaths: { player: PlayerId; lane: LaneIndex; name: string; effect: AutoEffect }[] = [];
    for (const player of [0, 1] as PlayerId[]) {
      const p = state.players[player];
      for (const lane of LANES) {
        const side = p.lanes[lane];
        for (const row of ROWS) {
          const c = side[row];
          if (!c || power(c) > 0) continue;
          side[row] = null;
          discardCreature(p, c);
          state.events.push({ type: 'death', player, lane, row });
          changed = true;
          const card = creatureCard(c.cardId);
          if (card.ability?.trigger === 'onDeath') deaths.push({ player, lane, name: card.name, effect: card.ability.effect });
        }
        if (!side.front && side.back) {
          side.front = side.back;
          side.back = null;
        }
      }
    }
    for (const d of deaths) {
      log(state, `${d.name}'s death ability triggers.`);
      resolveAutoEffect(state, d.player, d.lane, d.effect, null);
    }
  }
}

// ---------- Effects ----------

function resolveAutoEffect(state: GameState, player: PlayerId, lane: LaneIndex, effect: AutoEffect, self: Creature | null) {
  const opp = other(player);
  const pos = self ? locate(state, self.uid) : null;
  const partner = pos ? state.players[player].lanes[pos.lane][otherRow(pos.row)] : null;
  switch (effect.type) {
    case 'damageEnemyFront':
      damageCreatureAt(state, opp, lane, 'front', effect.amount);
      break;
    case 'damageAllEnemyFronts':
      for (const l of LANES) damageCreatureAt(state, opp, l, 'front', effect.amount);
      break;
    case 'damageEnemyCrystal':
      damageCrystal(state, opp, lane, effect.amount);
      break;
    case 'healCrystal':
      healCrystal(state, player, lane, effect.amount);
      break;
    case 'healSelf':
      if (self) heal(self, effect.amount);
      break;
    case 'buffSelf':
      if (self) self.buff += effect.amount;
      break;
    case 'buffPartner':
      if (partner) partner.buff += effect.amount;
      break;
    case 'healPartner':
      if (partner) heal(partner, effect.amount);
      break;
    case 'draw':
      for (let i = 0; i < effect.amount; i++) drawCard(state, player);
      break;
  }
}

/** Reveals and resolves a trap against a creature. Returns true if the attack is cancelled. */
function springTrap(state: GameState, owner: PlayerId, lane: LaneIndex, victim: Creature): boolean {
  const side = state.players[owner].lanes[lane];
  const trap = getCard(side.trap!.cardId);
  state.players[owner].discard.push(side.trap!.cardId);
  side.trap = null;
  if (trap.kind !== 'trap') return false;
  log(state, `⚠️ Trap! ${state.players[owner].name} reveals ${trap.name}.`);
  state.events.push({ type: 'trap', player: owner, cardId: trap.id, lane });
  const pos = locate(state, victim.uid)!;
  const name = creatureCard(victim.cardId).name;
  switch (trap.effect.type) {
    case 'damage':
      damageCreatureAt(state, pos.player, pos.lane, pos.row, trap.effect.amount);
      return false;
    case 'destroyIfAtMost':
      if (power(victim) <= trap.effect.amount) {
        victim.damage = victim.basePower + victim.buff;
        log(state, `${name} is destroyed.`);
      } else {
        log(state, `${name} is too strong to be caught.`);
      }
      return false;
    case 'cancel':
      log(state, `${name}'s attack is cancelled.`);
      return true;
  }
}

// ---------- Turns ----------

function startTurn(state: GameState) {
  const player = state.active;
  const p = state.players[player];
  p.turnsTaken++;
  p.maxEnergy = Math.min(MAX_ENERGY, p.turnsTaken);
  p.energy = p.maxEnergy;
  state.phase = 'main';
  log(state, `— Turn ${state.turn}: ${p.name} (${p.energy} energy) —`);
  state.events.push({ type: 'turnStart', player });

  const firstTurnOfGame = player === state.firstPlayer && p.turnsTaken === 1;
  if (!firstTurnOfGame) drawCard(state, player);

  for (const lane of LANES) {
    const regen = laneRelicAmount(p.lanes[lane], 'laneRegen');
    if (regen) healCrystal(state, player, lane, regen);
  }
  const creatures = LANES.flatMap((lane) => ROWS.map((row) => p.lanes[lane][row])).filter((c): c is Creature => !!c);
  for (const c of creatures) {
    const pos = locate(state, c.uid);
    if (!pos || power(c) <= 0) continue;
    const ability = creatureCard(c.cardId).ability;
    if (ability?.trigger === 'startOfTurn') resolveAutoEffect(state, player, pos.lane, ability.effect, c);
    const mend = synergyAmount(p.lanes[pos.lane], pos.row, 'mend');
    if (mend) heal(c, mend);
  }
  cleanup(state);
  checkWinner(state);
}

// ---------- Validation ----------

/** Lanes the creature in this slot can attack right now (empty if it can't attack). */
export function attackTargets(state: GameState, player: PlayerId, lane: LaneIndex, row: Row): LaneIndex[] {
  const c = state.players[player].lanes[lane][row];
  const p = state.players[player];
  if (!c || state.active !== player || (state.phase !== 'main' && state.phase !== 'combat')) return [];
  if (player === state.firstPlayer && p.turnsTaken === 1) return [];
  if (c.attackedTurn === state.turn || c.movedTurn === state.turn) return [];
  if (c.playedTurn === state.turn && !hasKeyword(c, 'Rush')) return [];
  if (row === 'back' && !hasKeyword(c, 'Ranged')) return [];
  // A lane is worth attacking while it has a crystal or creatures. Once the lane opposite has
  // neither, creatures there may attack an adjacent lane instead.
  const enemyLanes = state.players[other(player)].lanes;
  const worthAttacking = (l: LaneIndex) => !enemyLanes[l].destroyed || !!enemyLanes[l].front;
  if (worthAttacking(lane)) return [lane];
  return adjacentLanes(lane).filter(worthAttacking);
}

const hasRoom = (side: LaneSide) => !side.front || !side.back;

function validateTarget(state: GameState, target: Target | undefined, owner: 'mine' | 'enemy', kind: Target['kind']): string | null {
  if (!target || target.kind !== kind) return `Choose a ${kind === 'creature' ? 'creature' : 'lane'}.`;
  const expected = owner === 'mine' ? state.active : other(state.active);
  if (target.player !== expected) return `Choose ${owner === 'mine' ? 'one of your own' : 'an enemy'} ${kind}.`;
  const side = state.players[target.player].lanes[target.lane];
  if (target.kind === 'creature' && !side[target.row]) return 'There is no creature there.';
  return null;
}

/** Returns why an action is illegal, or null if it is legal. */
export function validate(state: GameState, action: Action): string | null {
  if (state.phase === 'over') return 'The game is over.';
  if (action.type === 'mulligan') {
    if (state.phase !== 'mulligan') return 'The mulligan is over.';
    return state.players[action.player].mulliganDone ? 'Already decided.' : null;
  }
  if (state.phase === 'mulligan') return 'Waiting for both players to keep or redraw.';

  const me = state.active;
  const p = state.players[me];

  switch (action.type) {
    case 'endTurn':
      return null;

    case 'attack':
      return attackTargets(state, me, action.lane, action.row).includes(action.targetLane) ? null : 'That creature cannot attack there.';

    case 'move': {
      if (state.phase !== 'main') return 'Creatures can only move before combat.';
      const c = p.lanes[action.lane][action.row];
      if (!c) return 'There is no creature there.';
      if (p.energy < MOVE_COST) return 'Not enough energy.';
      if (c.movedTurn === state.turn) return 'That creature already moved this turn.';
      if (Math.abs(action.toLane - action.lane) !== 1) return 'Creatures can only move to an adjacent lane.';
      return hasRoom(p.lanes[action.toLane]) ? null : 'That lane is full.';
    }
  }

  if (state.phase !== 'main') return 'Cards can only be played before combat.';
  const cardId = p.hand[action.handIndex];
  if (!cardId) return 'No such card.';
  const card = getCard(cardId);
  if (card.cost > p.energy) return 'Not enough energy.';

  switch (action.type) {
    case 'playCreature':
      if (card.kind !== 'creature') return 'That is not a creature.';
      if (!isDirectlyPlayable(card)) return `${card.name} must evolve from a ${card.stars - 1}★ ${card.type}.`;
      return hasRoom(p.lanes[action.lane]) ? null : 'That lane is full.';

    case 'evolve': {
      if (card.kind !== 'creature' || isDirectlyPlayable(card)) return 'That card cannot evolve a creature.';
      const c = p.lanes[action.lane][action.row];
      if (!c) return 'There is no creature there.';
      const base = creatureCard(c.cardId);
      if (base.type !== card.type || base.stars !== card.stars - 1) return `${card.name} evolves from a ${card.stars - 1}★ ${card.type}.`;
      if (c.evolvedTurn === state.turn) return 'A creature can only evolve once per turn.';
      return null;
    }

    case 'castSpell': {
      if (card.kind !== 'spell') return 'That is not a spell.';
      switch (card.effect.type) {
        case 'damageCreature':
          return validateTarget(state, action.target, 'enemy', 'creature');
        case 'healCreature':
        case 'buffCreature':
          return validateTarget(state, action.target, 'mine', 'creature');
        case 'damageLane':
          return validateTarget(state, action.target, 'enemy', 'lane');
        case 'healCrystal': {
          const err = validateTarget(state, action.target, 'mine', 'lane');
          if (err) return err;
          return p.lanes[action.target!.lane].destroyed ? 'That crystal is destroyed.' : null;
        }
        default:
          return action.target ? 'This spell has no target.' : null;
      }
    }

    case 'playRelic': {
      if (card.kind !== 'relic') return 'That is not a relic.';
      if (card.effect.type === 'equip') {
        const err = validateTarget(state, action.target, 'mine', 'creature');
        if (err) return err;
        const t = action.target as Extract<Target, { kind: 'creature' }>;
        return p.lanes[t.lane][t.row]!.equipment ? 'That creature already has a relic.' : null;
      }
      const err = validateTarget(state, action.target, 'mine', 'lane');
      if (err) return err;
      return p.lanes[action.target.lane].relic ? 'That lane already has a relic.' : null;
    }

    case 'setTrap':
      if (card.kind !== 'trap') return 'That is not a trap.';
      return p.lanes[action.lane].trap ? 'That lane already has a trap.' : null;
  }
}

// ---------- Applying actions ----------

function payFromHand(state: GameState, handIndex: number) {
  const p = state.players[state.active];
  const [cardId] = p.hand.splice(handIndex, 1);
  p.energy -= getCard(cardId).cost;
  return cardId;
}

export function applyAction(state: GameState, action: Action) {
  const error = validate(state, action);
  if (error) throw new Error(error);

  const me = state.active;
  const opp = other(me);
  const p = state.players[me];

  switch (action.type) {
    case 'mulligan': {
      const mp = state.players[action.player];
      if (action.redraw) {
        mp.deck.push(...mp.hand);
        mp.hand = [];
        shuffle(state, mp.deck);
        for (let i = 0; i < STARTING_HAND; i++) drawCard(state, action.player);
      }
      mp.mulliganDone = true;
      log(state, `${mp.name} ${action.redraw ? 'redraws their hand' : 'keeps their hand'}.`);
      if (state.players.every((x) => x.mulliganDone)) {
        state.turn = 1;
        startTurn(state);
      }
      return;
    }

    case 'playCreature': {
      const cardId = payFromHand(state, action.handIndex);
      const c = spawnCreature(state, me, action.lane, cardId);
      const card = creatureCard(cardId);
      log(state, `${p.name} plays ${card.name} in the ${laneName(action.lane)} lane.`);
      state.events.push({ type: 'play', player: me, cardId, lane: action.lane, row: locate(state, c.uid)!.row });
      const enemyTrap = state.players[opp].lanes[action.lane].trap;
      const trap = enemyTrap && getCard(enemyTrap.cardId);
      if (trap && trap.kind === 'trap' && trap.trigger === 'play') springTrap(state, opp, action.lane, c);
      cleanup(state);
      if (card.ability?.trigger === 'onPlay' && locate(state, c.uid)) resolveAutoEffect(state, me, action.lane, card.ability.effect, c);
      break;
    }

    case 'evolve': {
      const c = p.lanes[action.lane][action.row]!;
      const from = creatureCard(c.cardId).name;
      const cardId = payFromHand(state, action.handIndex);
      const card = creatureCard(cardId);
      c.stack.push(c.cardId);
      c.cardId = cardId;
      c.basePower = card.power;
      c.shield = c.shield || card.keywords.includes('Shield');
      c.evolvedTurn = state.turn;
      log(state, `${from} evolves into ${card.name}! (PL ${power(c)})`);
      state.events.push({ type: 'evolve', player: me, cardId, lane: action.lane, row: action.row });
      if (card.ability?.trigger === 'onPlay') resolveAutoEffect(state, me, action.lane, card.ability.effect, c);
      break;
    }

    case 'castSpell': {
      const card = getCard(payFromHand(state, action.handIndex));
      if (card.kind !== 'spell') break;
      log(state, `${p.name} casts ${card.name}.`);
      state.events.push({ type: 'reveal', player: me, cardId: card.id, target: action.target });
      const t = action.target;
      const e = card.effect;
      const targetCreature = t?.kind === 'creature' ? state.players[t.player].lanes[t.lane][t.row] : null;
      switch (e.type) {
        case 'damageCreature':
          damageCreatureAt(state, opp, t!.lane, (t as Extract<Target, { kind: 'creature' }>).row, e.amount);
          break;
        case 'healCreature':
          heal(targetCreature!, e.amount);
          break;
        case 'buffCreature':
          targetCreature!.buff += e.amount;
          break;
        case 'damageLane':
          damageLane(state, opp, t!.lane, e.amount);
          break;
        case 'healCrystal':
          healCrystal(state, me, t!.lane, e.amount);
          break;
        case 'damageAllEnemies':
          for (const lane of LANES) for (const row of ROWS) damageCreatureAt(state, opp, lane, row, e.amount);
          break;
        case 'draw':
          for (let i = 0; i < e.amount; i++) drawCard(state, me);
          break;
      }
      p.discard.push(card.id);
      break;
    }

    case 'playRelic': {
      const card = getCard(payFromHand(state, action.handIndex));
      if (card.kind !== 'relic') break;
      const t = action.target;
      state.events.push({ type: 'reveal', player: me, cardId: card.id, target: t });
      if (card.effect.type === 'equip' && t.kind === 'creature') {
        const c = p.lanes[t.lane][t.row]!;
        c.equipment = card.id;
        c.buff += card.effect.buff;
        if (card.effect.keyword) {
          c.granted.push(card.effect.keyword);
          if (card.effect.keyword === 'Shield') c.shield = true;
        }
        log(state, `${p.name} equips ${card.name} to ${creatureCard(c.cardId).name}.`);
      } else {
        p.lanes[t.lane].relic = card.id;
        log(state, `${p.name} places ${card.name} in the ${laneName(t.lane)} lane.`);
      }
      break;
    }

    case 'setTrap': {
      const cardId = payFromHand(state, action.handIndex);
      p.lanes[action.lane].trap = { cardId, setTurn: state.turn };
      state.events.push({ type: 'reveal', player: me, cardId, target: { kind: 'lane', player: me, lane: action.lane } });
      log(state, `${p.name} sets a face-down trap in the ${laneName(action.lane)} lane.`);
      break;
    }

    case 'move': {
      const from = p.lanes[action.lane];
      const c = from[action.row]!;
      from[action.row] = null;
      if (!from.front && from.back) {
        from.front = from.back;
        from.back = null;
      }
      const to = p.lanes[action.toLane];
      if (!to.front) to.front = c;
      else to.back = c;
      c.movedTurn = state.turn;
      p.energy -= MOVE_COST;
      log(state, `${creatureCard(c.cardId).name} moves to the ${laneName(action.toLane)} lane.`);
      break;
    }

    case 'attack':
      resolveAttack(state, action.lane, action.row, action.targetLane);
      break;

    case 'endTurn':
      log(state, `${p.name} ends their turn.`);
      state.active = opp;
      state.turn++;
      startTurn(state);
      return;
  }
  cleanup(state);
}

function resolveAttack(state: GameState, lane: LaneIndex, row: Row, targetLane: LaneIndex) {
  const me = state.active;
  const opp = other(me);
  const attacker = state.players[me].lanes[lane][row]!;
  const name = creatureCard(attacker.cardId).name;
  state.phase = 'combat';
  attacker.attackedTurn = state.turn;
  log(state, `⚔️ ${name} attacks the ${laneName(targetLane)} lane.`);
  state.events.push({ type: 'attack', player: me, lane, row, targetLane });

  const defSide = state.players[opp].lanes[targetLane];
  if (defSide.trap) {
    const trap = getCard(defSide.trap.cardId);
    if (trap.kind === 'trap' && trap.trigger === 'attack') {
      const cancelled = springTrap(state, opp, targetLane, attacker);
      if (cancelled || power(attacker) <= 0) return;
    }
  }

  const mySide = state.players[me].lanes[lane];
  const bonus = synergyAmount(mySide, row, 'strike') + laneRelicAmount(mySide, 'laneStrike');
  const pierce = hasKeyword(attacker, 'Pierce');
  const front = defSide.front;

  // Ranged creatures attacking from the back row are never hit back.
  if (!front || (row === 'back' && hasKeyword(attacker, 'Ranged'))) {
    damageLane(state, opp, targetLane, power(attacker) + bonus, pierce);
    return;
  }

  const frontName = creatureCard(front.cardId).name;
  const attackerFirst = isExposed(state, opp, front) || hasKeyword(attacker, 'First Strike');
  if (attackerFirst) {
    // The attacker strikes first; a surviving defender hits back with what it has left.
    damageLane(state, opp, targetLane, power(attacker) + bonus, pierce);
    if (power(front) > 0) {
      log(state, `${frontName} strikes back for ${power(front)}.`);
      damageCreatureAt(state, me, lane, row, power(front));
    }
  } else {
    // A Guarding defender strikes first; a surviving attacker then hits with what it has left.
    log(state, `🛡 ${frontName} is guarding and strikes first for ${power(front)}.`);
    damageCreatureAt(state, me, lane, row, power(front));
    if (power(attacker) > 0) damageLane(state, opp, targetLane, power(attacker) + bonus, pierce);
  }
}

// ---------- Legal actions ----------

function allTargets(): Target[] {
  const targets: Target[] = [];
  for (const player of [0, 1] as PlayerId[]) {
    for (const lane of LANES) {
      targets.push({ kind: 'lane', player, lane });
      for (const row of ROWS) targets.push({ kind: 'creature', player, lane, row });
    }
  }
  return targets;
}

export function getLegalActions(state: GameState): Action[] {
  if (state.phase === 'over') return [];
  if (state.phase === 'mulligan') {
    return ([0, 1] as PlayerId[])
      .filter((player) => !state.players[player].mulliganDone)
      .flatMap((player) => [false, true].map((redraw): Action => ({ type: 'mulligan', player, redraw })));
  }

  const me = state.active;
  const p = state.players[me];
  const candidates: Action[] = [{ type: 'endTurn' }];

  p.hand.forEach((cardId, handIndex) => {
    const card = getCard(cardId);
    if (card.cost > p.energy) return;
    switch (card.kind) {
      case 'creature':
        for (const lane of LANES) {
          candidates.push({ type: 'playCreature', handIndex, lane });
          for (const row of ROWS) candidates.push({ type: 'evolve', handIndex, lane, row });
        }
        break;
      case 'spell':
        candidates.push({ type: 'castSpell', handIndex });
        for (const target of allTargets()) candidates.push({ type: 'castSpell', handIndex, target });
        break;
      case 'relic':
        for (const target of allTargets()) candidates.push({ type: 'playRelic', handIndex, target });
        break;
      case 'trap':
        for (const lane of LANES) candidates.push({ type: 'setTrap', handIndex, lane });
        break;
    }
  });

  for (const lane of LANES) {
    for (const row of ROWS) {
      if (!p.lanes[lane][row]) continue;
      for (const toLane of adjacentLanes(lane)) candidates.push({ type: 'move', lane, row, toLane });
      for (const targetLane of attackTargets(state, me, lane, row)) candidates.push({ type: 'attack', lane, row, targetLane });
    }
  }

  return candidates.filter((a) => validate(state, a) === null);
}
