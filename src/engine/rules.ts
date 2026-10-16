import type { CreatureType } from './types';

// Starting values from RULES.md. Tune these through play-testing.
export const CRYSTAL_HP = 30;
export const CRYSTALS_TO_WIN = 2;
export const MAX_ENERGY = 10;
export const STARTING_HAND = 5;
export const HAND_LIMIT = 10;
export const DECK_SIZE = 30;
export const MOVE_COST = 1;
export const MAX_COPIES = 2;
export const MAX_LEGENDARY_COPIES = 1;

/** Each type complements the next: Goblin → Beast → Elemental → Undead → Knight → Goblin. */
export const COMPLEMENT: Record<CreatureType, CreatureType> = {
  Goblin: 'Beast',
  Beast: 'Elemental',
  Elemental: 'Undead',
  Undead: 'Knight',
  Knight: 'Goblin',
};

export const LANE_NAMES = ['left', 'middle', 'right'] as const;
