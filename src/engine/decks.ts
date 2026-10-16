import { ALL_CARDS, getCard } from './cards';
import { DECK_SIZE, MAX_COPIES, MAX_LEGENDARY_COPIES } from './rules';
import type { CreatureType } from './types';

export interface DeckDef {
  id: string;
  name: string;
  types: CreatureType[];
  description: string;
  cards: string[];
}

/**
 * Two complementary types. Per type: 1★ ×2 (the most expensive 1★ ×1), every 2★ ×2 and the 3★ ×1,
 * plus the first type's legendary (25 creatures), then 5 support cards.
 */
function buildDeck(primary: CreatureType, secondary: CreatureType, support: string[]): string[] {
  const cards: string[] = [];
  for (const type of [primary, secondary]) {
    const creatures = ALL_CARDS.filter((c) => c.kind === 'creature' && c.type === type);
    const oneStars = creatures.filter((c) => c.kind === 'creature' && c.stars === 1).sort((a, b) => a.cost - b.cost);
    for (const c of creatures) {
      if (c.kind !== 'creature') continue;
      if (c.legendary) {
        if (type === primary) cards.push(c.id);
      } else if (c.stars === 1) {
        cards.push(c.id);
        if (c !== oneStars[oneStars.length - 1]) cards.push(c.id);
      } else {
        cards.push(c.id);
        if (c.stars === 2) cards.push(c.id);
      }
    }
  }
  cards.push(...support);
  if (cards.length !== DECK_SIZE) throw new Error(`${primary}/${secondary} deck has ${cards.length} cards`);
  return cards;
}

export const STARTER_DECKS: DeckDef[] = [
  {
    id: 'horde',
    name: "Grubnak's Horde",
    types: ['Goblin', 'Beast'],
    description: 'Fast and aggressive. Swarm the lanes and break crystals early.',
    cards: buildDeck('Goblin', 'Beast', ['firebolt', 'firebolt', 'rally', 'war-banner', 'pitfall']),
  },
  {
    id: 'wild-storm',
    name: 'Wild Storm',
    types: ['Beast', 'Elemental'],
    description: 'Big beasts backed by burning elementals.',
    cards: buildDeck('Beast', 'Elemental', ['firebolt', 'fireball', 'rally', 'pitfall', 'catapult']),
  },
  {
    id: 'ashen-rite',
    name: 'Ashen Rite',
    types: ['Elemental', 'Undead'],
    description: 'Ranged damage and creatures that keep coming back for value.',
    cards: buildDeck('Elemental', 'Undead', ['firebolt', 'shockwave', 'insight', 'smoke-screen', 'ambush']),
  },
  {
    id: 'vanguard',
    name: "Death's Vanguard",
    types: ['Undead', 'Knight'],
    description: 'Defensive. Outlast the opponent, then finish with a Lich.',
    cards: buildDeck('Undead', 'Knight', ['mend', 'reinforce', 'bear-trap', 'iron-armor', 'healing-totem']),
  },
  {
    id: 'banner-blade',
    name: 'Banner & Blade',
    types: ['Knight', 'Goblin'],
    description: 'Shielded knights in front, goblin archers behind.',
    cards: buildDeck('Knight', 'Goblin', ['firebolt', 'rally', 'war-banner', 'ambush', 'longbow']),
  },
];

// ---------- Deck rules (used by the deck builder) ----------

export function copyLimit(cardId: string): number {
  const card = getCard(cardId);
  return card.kind === 'creature' && card.legendary ? MAX_LEGENDARY_COPIES : MAX_COPIES;
}

export function countCards(cards: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of cards) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Reasons the deck can't be played. Empty means it's legal. */
export function deckProblems(cards: string[]): string[] {
  const problems: string[] = [];
  if (cards.length !== DECK_SIZE) problems.push(`A deck needs exactly ${DECK_SIZE} cards (this one has ${cards.length}).`);
  for (const [id, n] of countCards(cards)) {
    if (n > copyLimit(id)) problems.push(`Too many copies of ${getCard(id).name} (max ${copyLimit(id)}).`);
  }
  return problems;
}

/** Legal but probably unwise: evolution cards with too few creatures to evolve from. */
export function deckWarnings(cards: string[]): string[] {
  const warnings: string[] = [];
  // Legendaries are played directly, so they neither evolve nor count as something to evolve from.
  const count = (type: CreatureType, stars: number) =>
    cards.filter((id) => {
      const c = getCard(id);
      return c.kind === 'creature' && c.type === type && c.stars === stars && !c.legendary;
    }).length;
  for (const type of ['Goblin', 'Undead', 'Elemental', 'Knight', 'Beast'] as CreatureType[]) {
    for (const stars of [2, 3]) {
      const evolutions = count(type, stars);
      const bases = count(type, stars - 1);
      if (evolutions && !bases) warnings.push(`Your ${stars}★ ${type} cards have no ${stars - 1}★ ${type} to evolve from.`);
      else if (evolutions > bases) warnings.push(`More ${stars}★ ${type} evolutions (${evolutions}) than ${stars - 1}★ ${type} creatures (${bases}).`);
    }
  }
  return warnings;
}

/** The deck's two most common creature types. */
export function mainTypes(cards: string[]): CreatureType[] {
  const counts = new Map<CreatureType, number>();
  for (const id of cards) {
    const c = getCard(id);
    if (c.kind === 'creature') counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
}
