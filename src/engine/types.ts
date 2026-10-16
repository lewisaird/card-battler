export type CreatureType = 'Goblin' | 'Undead' | 'Elemental' | 'Knight' | 'Beast';
export type Keyword = 'Rush' | 'Ranged' | 'Shield' | 'Pierce' | 'First Strike';
export type Stars = 1 | 2 | 3;
export type PlayerId = 0 | 1;
export type LaneIndex = 0 | 1 | 2;
export type Row = 'front' | 'back';

// ---------- Card definitions ----------

/** Effects used by creature abilities. Targets are automatic, relative to the creature's lane. */
export type AutoEffect =
  | { type: 'damageEnemyFront'; amount: number }
  | { type: 'damageAllEnemyFronts'; amount: number }
  | { type: 'damageEnemyCrystal'; amount: number }
  | { type: 'healCrystal'; amount: number }
  | { type: 'healSelf'; amount: number }
  | { type: 'buffSelf'; amount: number }
  | { type: 'buffPartner'; amount: number }
  | { type: 'healPartner'; amount: number }
  | { type: 'draw'; amount: number };

export interface Ability {
  trigger: 'onPlay' | 'onDeath' | 'startOfTurn';
  effect: AutoEffect;
}

/** Active while the other creature in the same lane is the same type or this type's complement. */
export interface Synergy {
  kind: 'strike' | 'guard' | 'mend';
  amount: number;
}

interface CardBase {
  id: string;
  name: string;
  cost: number;
}

export interface CreatureCard extends CardBase {
  kind: 'creature';
  type: CreatureType;
  stars: Stars;
  power: number;
  keywords: Keyword[];
  ability?: Ability;
  synergy?: Synergy;
  /** 3★ creatures that can be played directly, without evolving. */
  legendary?: boolean;
}

export type SpellEffect =
  | { type: 'damageCreature'; amount: number }
  | { type: 'healCreature'; amount: number }
  | { type: 'buffCreature'; amount: number }
  | { type: 'damageLane'; amount: number }
  | { type: 'healCrystal'; amount: number }
  | { type: 'damageAllEnemies'; amount: number }
  | { type: 'draw'; amount: number };

export interface SpellCard extends CardBase {
  kind: 'spell';
  effect: SpellEffect;
}

export type RelicEffect =
  | { type: 'equip'; buff: number; keyword?: Keyword }
  | { type: 'laneStrike'; amount: number }
  | { type: 'laneRegen'; amount: number };

export interface RelicCard extends CardBase {
  kind: 'relic';
  effect: RelicEffect;
}

export type TrapEffect =
  | { type: 'damage'; amount: number }
  | { type: 'destroyIfAtMost'; amount: number }
  | { type: 'cancel' };

export interface TrapCard extends CardBase {
  kind: 'trap';
  trigger: 'attack' | 'play';
  effect: TrapEffect;
}

export type Card = CreatureCard | SpellCard | RelicCard | TrapCard;

// ---------- Game state ----------

export interface Creature {
  uid: number;
  cardId: string;
  basePower: number;
  buff: number;
  damage: number;
  /** Keywords granted by relics, kept through evolution. */
  granted: Keyword[];
  shield: boolean;
  playedTurn: number;
  evolvedTurn: number;
  movedTurn: number;
  attackedTurn: number;
  equipment: string | null;
  /** Cards this creature evolved from, discarded with it. */
  stack: string[];
}

export interface LaneSide {
  front: Creature | null;
  back: Creature | null;
  trap: { cardId: string; setTurn: number } | null;
  relic: string | null;
  crystal: number;
  destroyed: boolean;
}

export interface PlayerState {
  name: string;
  isAI: boolean;
  deck: string[];
  hand: string[];
  discard: string[];
  lanes: [LaneSide, LaneSide, LaneSide];
  energy: number;
  maxEnergy: number;
  turnsTaken: number;
  fatigue: number;
  mulliganDone: boolean;
}

/** Notable moments, for the UI to react to (rival dialogue, effects). */
export type GameEvent =
  | { type: 'turnStart'; player: PlayerId }
  | { type: 'play'; player: PlayerId; cardId: string; lane: LaneIndex; row: Row }
  | { type: 'evolve'; player: PlayerId; cardId: string; lane: LaneIndex; row: Row }
  | { type: 'attack'; player: PlayerId; lane: LaneIndex; row: Row; targetLane: LaneIndex }
  | { type: 'damage'; player: PlayerId; lane: LaneIndex; target: Row | 'crystal'; amount: number }
  | { type: 'blocked'; player: PlayerId; lane: LaneIndex; row: Row }
  | { type: 'death'; player: PlayerId; lane: LaneIndex; row: Row }
  | { type: 'trap'; player: PlayerId; cardId: string; lane: LaneIndex }
  /** A spell cast, relic placed or trap set. Set traps stay secret from the opponent. */
  | { type: 'reveal'; player: PlayerId; cardId: string; target?: Target }
  | { type: 'crystalDestroyed'; player: PlayerId; lane: LaneIndex }
  | { type: 'win'; player: PlayerId };

export interface GameState {
  players: [PlayerState, PlayerState];
  active: PlayerId;
  firstPlayer: PlayerId;
  /** Global turn counter; both players' turns count. */
  turn: number;
  phase: 'mulligan' | 'main' | 'combat' | 'over';
  winner: PlayerId | null;
  log: string[];
  events: GameEvent[];
  rng: number;
  nextUid: number;
}

// ---------- Actions ----------

export type Target =
  | { kind: 'creature'; player: PlayerId; lane: LaneIndex; row: Row }
  | { kind: 'lane'; player: PlayerId; lane: LaneIndex };

export type Action =
  | { type: 'mulligan'; player: PlayerId; redraw: boolean }
  | { type: 'playCreature'; handIndex: number; lane: LaneIndex }
  | { type: 'evolve'; handIndex: number; lane: LaneIndex; row: Row }
  | { type: 'castSpell'; handIndex: number; target?: Target }
  | { type: 'playRelic'; handIndex: number; target: Target }
  | { type: 'setTrap'; handIndex: number; lane: LaneIndex }
  | { type: 'move'; lane: LaneIndex; row: Row; toLane: LaneIndex }
  | { type: 'attack'; lane: LaneIndex; row: Row; targetLane: LaneIndex }
  | { type: 'endTurn' };
