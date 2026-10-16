import { COMPLEMENT } from './rules';
import type {
  AutoEffect,
  Card,
  CreatureCard,
  CreatureType,
  Keyword,
  RelicCard,
  SpellCard,
  Stars,
  TrapCard,
} from './types';

type CreatureExtras = Partial<Pick<CreatureCard, 'keywords' | 'ability' | 'synergy' | 'legendary'>>;

function creature(
  id: string,
  name: string,
  type: CreatureType,
  stars: Stars,
  cost: number,
  power: number,
  extras: CreatureExtras = {},
): CreatureCard {
  return { kind: 'creature', id, name, type, stars, cost, power, keywords: [], ...extras };
}

const kw = (...keywords: Keyword[]) => ({ keywords });

// Placeholder starter set: 8 creatures per type (four 1★, two 2★, one 3★, one legendary 3★).
const CREATURES: CreatureCard[] = [
  // Goblin: cheap and aggressive.
  creature('goblin-grunt', 'Goblin Grunt', 'Goblin', 1, 1, 2, { synergy: { kind: 'strike', amount: 1 } }),
  creature('goblin-sneak', 'Goblin Sneak', 'Goblin', 1, 2, 3, {
    ...kw('Rush'),
    ability: { trigger: 'onPlay', effect: { type: 'damageEnemyCrystal', amount: 1 } },
  }),
  creature('goblin-archer', 'Goblin Archer', 'Goblin', 1, 2, 3, kw('Ranged')),
  creature('goblin-bomber', 'Goblin Bomber', 'Goblin', 1, 2, 3, {
    ability: { trigger: 'onDeath', effect: { type: 'damageEnemyFront', amount: 2 } },
  }),
  creature('goblin-chief', 'Goblin Chief', 'Goblin', 2, 3, 6, { synergy: { kind: 'strike', amount: 2 } }),
  creature('goblin-shaman', 'Goblin Shaman', 'Goblin', 2, 3, 6, {
    ...kw('Ranged'),
    ability: { trigger: 'onPlay', effect: { type: 'healPartner', amount: 3 } },
  }),
  creature('goblin-warlord', 'Goblin Warlord', 'Goblin', 3, 5, 10, kw('Rush')),
  creature('king-grubnak', 'King Grubnak', 'Goblin', 3, 8, 11, {
    ...kw('Rush'),
    legendary: true,
    ability: { trigger: 'onPlay', effect: { type: 'damageEnemyFront', amount: 3 } },
  }),

  // Undead: hard to kill, value when they die.
  creature('skeleton', 'Skeleton', 'Undead', 1, 1, 2, { synergy: { kind: 'guard', amount: 1 } }),
  creature('zombie', 'Zombie', 'Undead', 1, 2, 3, {
    ability: { trigger: 'startOfTurn', effect: { type: 'healSelf', amount: 1 } },
  }),
  creature('ghoul', 'Ghoul', 'Undead', 1, 2, 2, {
    ability: { trigger: 'onDeath', effect: { type: 'draw', amount: 1 } },
  }),
  creature('banshee', 'Banshee', 'Undead', 1, 3, 2, {
    ...kw('Ranged'),
    ability: { trigger: 'onPlay', effect: { type: 'damageEnemyFront', amount: 2 } },
  }),
  creature('wight', 'Wight', 'Undead', 2, 4, 6, { synergy: { kind: 'guard', amount: 1 } }),
  creature('necromancer', 'Necromancer', 'Undead', 2, 3, 4, {
    ...kw('Ranged'),
    ability: { trigger: 'startOfTurn', effect: { type: 'healPartner', amount: 2 } },
  }),
  creature('lich', 'Lich', 'Undead', 3, 6, 10, {
    ability: { trigger: 'startOfTurn', effect: { type: 'damageEnemyCrystal', amount: 1 } },
  }),
  creature('bone-dragon', 'Bone Dragon', 'Undead', 3, 9, 12, {
    legendary: true,
    ability: { trigger: 'onDeath', effect: { type: 'damageEnemyCrystal', amount: 4 } },
  }),

  // Elemental: ranged damage and burn.
  creature('spark', 'Spark', 'Elemental', 1, 1, 1, {
    ...kw('Rush'),
    ability: { trigger: 'onPlay', effect: { type: 'damageEnemyFront', amount: 1 } },
  }),
  creature('ember-wisp', 'Ember Wisp', 'Elemental', 1, 2, 2, kw('Ranged')),
  creature('stone-golem', 'Stone Golem', 'Elemental', 1, 3, 3, kw('Shield')),
  creature('tide-spirit', 'Tide Spirit', 'Elemental', 1, 2, 3, {
    ability: { trigger: 'onPlay', effect: { type: 'healCrystal', amount: 2 } },
  }),
  creature('flame-elemental', 'Flame Elemental', 'Elemental', 2, 4, 6, kw('Pierce')),
  creature('storm-elemental', 'Storm Elemental', 'Elemental', 2, 4, 5, {
    ...kw('Ranged'),
    ability: { trigger: 'onPlay', effect: { type: 'damageEnemyFront', amount: 2 } },
  }),
  creature('inferno-titan', 'Inferno Titan', 'Elemental', 3, 6, 10, {
    ...kw('Pierce'),
    synergy: { kind: 'strike', amount: 2 },
  }),
  creature('primordial-tempest', 'Primordial Tempest', 'Elemental', 3, 9, 10, {
    ...kw('Ranged'),
    legendary: true,
    ability: { trigger: 'onPlay', effect: { type: 'damageAllEnemyFronts', amount: 2 } },
  }),

  // Knight: defensive, Shield and First Strike.
  creature('squire', 'Squire', 'Knight', 1, 1, 2, { synergy: { kind: 'guard', amount: 1 } }),
  creature('footman', 'Footman', 'Knight', 1, 2, 3),
  creature('crossbowman', 'Crossbowman', 'Knight', 1, 2, 2, kw('Ranged')),
  creature('shieldbearer', 'Shieldbearer', 'Knight', 1, 3, 3, kw('Shield')),
  creature('knight-captain', 'Knight Captain', 'Knight', 2, 4, 6, kw('First Strike')),
  creature('paladin', 'Paladin', 'Knight', 2, 4, 5, {
    ...kw('Shield'),
    ability: { trigger: 'onPlay', effect: { type: 'healCrystal', amount: 2 } },
  }),
  creature('champion', 'Champion', 'Knight', 3, 6, 8, kw('First Strike', 'Shield')),
  creature('king-aldric', 'King Aldric', 'Knight', 3, 8, 11, {
    ...kw('Shield'),
    legendary: true,
    ability: { trigger: 'onPlay', effect: { type: 'buffPartner', amount: 3 } },
  }),

  // Beast: big bodies that grow.
  creature('wolf', 'Wolf', 'Beast', 1, 1, 2, kw('Rush')),
  creature('boar', 'Boar', 'Beast', 1, 2, 4, { synergy: { kind: 'strike', amount: 1 } }),
  creature('hawk', 'Hawk', 'Beast', 1, 2, 3, kw('Ranged', 'Rush')),
  creature('bear-cub', 'Bear Cub', 'Beast', 1, 2, 3, {
    ability: { trigger: 'startOfTurn', effect: { type: 'buffSelf', amount: 1 } },
  }),
  creature('dire-wolf', 'Dire Wolf', 'Beast', 2, 3, 6, kw('Rush')),
  creature('great-bear', 'Great Bear', 'Beast', 2, 4, 8),
  creature('alpha-beast', 'Alpha Beast', 'Beast', 3, 6, 10, { synergy: { kind: 'strike', amount: 3 } }),
  creature('behemoth', 'Behemoth', 'Beast', 3, 8, 12, { ...kw('Pierce'), legendary: true }),
];

const SPELLS: SpellCard[] = [
  { kind: 'spell', id: 'firebolt', name: 'Firebolt', cost: 1, effect: { type: 'damageCreature', amount: 3 } },
  { kind: 'spell', id: 'fireball', name: 'Fireball', cost: 4, effect: { type: 'damageCreature', amount: 6 } },
  { kind: 'spell', id: 'rally', name: 'Rally', cost: 2, effect: { type: 'buffCreature', amount: 2 } },
  { kind: 'spell', id: 'mend', name: 'Mend', cost: 1, effect: { type: 'healCreature', amount: 3 } },
  { kind: 'spell', id: 'reinforce', name: 'Reinforce', cost: 2, effect: { type: 'healCrystal', amount: 4 } },
  { kind: 'spell', id: 'shockwave', name: 'Shockwave', cost: 5, effect: { type: 'damageAllEnemies', amount: 2 } },
  { kind: 'spell', id: 'insight', name: 'Insight', cost: 2, effect: { type: 'draw', amount: 2 } },
  { kind: 'spell', id: 'catapult', name: 'Catapult', cost: 3, effect: { type: 'damageLane', amount: 4 } },
];

const RELICS: RelicCard[] = [
  { kind: 'relic', id: 'war-banner', name: 'War Banner', cost: 2, effect: { type: 'laneStrike', amount: 2 } },
  { kind: 'relic', id: 'healing-totem', name: 'Healing Totem', cost: 2, effect: { type: 'laneRegen', amount: 2 } },
  { kind: 'relic', id: 'iron-armor', name: 'Iron Armor', cost: 2, effect: { type: 'equip', buff: 2, keyword: 'Shield' } },
  { kind: 'relic', id: 'longbow', name: 'Longbow', cost: 2, effect: { type: 'equip', buff: 1, keyword: 'Ranged' } },
];

const TRAPS: TrapCard[] = [
  { kind: 'trap', id: 'pitfall', name: 'Pitfall', cost: 2, trigger: 'attack', effect: { type: 'damage', amount: 3 } },
  { kind: 'trap', id: 'bear-trap', name: 'Bear Trap', cost: 3, trigger: 'attack', effect: { type: 'damage', amount: 5 } },
  { kind: 'trap', id: 'smoke-screen', name: 'Smoke Screen', cost: 1, trigger: 'attack', effect: { type: 'cancel' } },
  { kind: 'trap', id: 'ambush', name: 'Ambush', cost: 2, trigger: 'play', effect: { type: 'destroyIfAtMost', amount: 3 } },
];

export const ALL_CARDS: Card[] = [...CREATURES, ...SPELLS, ...RELICS, ...TRAPS];
export const CARDS: Record<string, Card> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export function getCard(id: string): Card {
  const card = CARDS[id];
  if (!card) throw new Error(`Unknown card: ${id}`);
  return card;
}

export function creatureCard(id: string): CreatureCard {
  const card = getCard(id);
  if (card.kind !== 'creature') throw new Error(`${id} is not a creature`);
  return card;
}

/** Can this creature card be played straight from hand (rather than evolved)? */
export function isDirectlyPlayable(card: CreatureCard): boolean {
  return card.stars === 1 || !!card.legendary;
}

// ---------- Card text ----------

function autoEffectText(e: AutoEffect): string {
  switch (e.type) {
    case 'damageEnemyFront':
      return `deal ${e.amount} to the enemy front creature in this lane`;
    case 'damageAllEnemyFronts':
      return `deal ${e.amount} to every enemy front creature`;
    case 'damageEnemyCrystal':
      return `deal ${e.amount} to the enemy crystal in this lane`;
    case 'healCrystal':
      return `heal your crystal in this lane by ${e.amount}`;
    case 'healSelf':
      return `heal this creature by ${e.amount}`;
    case 'buffSelf':
      return `this creature gains +${e.amount} PL`;
    case 'buffPartner':
      return `the other creature in this lane gains +${e.amount} PL`;
    case 'healPartner':
      return `heal the other creature in this lane by ${e.amount}`;
    case 'draw':
      return `draw ${e.amount} card${e.amount > 1 ? 's' : ''}`;
  }
}

const TRIGGER_TEXT = { onPlay: 'When played', onDeath: 'When destroyed', startOfTurn: 'Start of your turn' };

export function cardText(card: Card): string[] {
  const lines: string[] = [];
  switch (card.kind) {
    case 'creature': {
      if (card.legendary) lines.push('Legendary');
      else if (card.stars > 1) lines.push(`Evolves from any ${card.stars - 1}★ ${card.type}`);
      if (card.ability) lines.push(`${TRIGGER_TEXT[card.ability.trigger]}: ${autoEffectText(card.ability.effect)}.`);
      if (card.synergy) {
        const { kind, amount } = card.synergy;
        const effect =
          kind === 'strike'
            ? `+${amount} damage when attacking`
            : kind === 'guard'
              ? `takes ${amount} less damage`
              : `heals ${amount} at the start of your turn`;
        lines.push(`Synergy (${card.type}/${COMPLEMENT[card.type]}): ${effect}.`);
      }
      break;
    }
    case 'spell': {
      const e = card.effect;
      const text = {
        damageCreature: `Deal ${e.amount} damage to an enemy creature.`,
        healCreature: `Heal one of your creatures by ${e.amount}.`,
        buffCreature: `One of your creatures gains +${e.amount} PL.`,
        damageLane: `Deal ${e.amount} damage to an enemy lane (front, then back, then crystal).`,
        healCrystal: `Heal one of your crystals by ${e.amount}.`,
        damageAllEnemies: `Deal ${e.amount} damage to every enemy creature.`,
        draw: `Draw ${e.amount} cards.`,
      }[e.type];
      lines.push(text);
      break;
    }
    case 'relic': {
      const e = card.effect;
      if (e.type === 'equip') lines.push(`Equip to your creature: +${e.buff} PL${e.keyword ? ` and ${e.keyword}` : ''}.`);
      if (e.type === 'laneStrike') lines.push(`Lane relic: your creatures here deal +${e.amount} damage when attacking.`);
      if (e.type === 'laneRegen') lines.push(`Lane relic: heal this lane's crystal by ${e.amount} at the start of your turn.`);
      break;
    }
    case 'trap': {
      const when = card.trigger === 'attack' ? 'When an enemy attacks this lane' : 'When an enemy creature is played in this lane';
      const e = card.effect;
      const what =
        e.type === 'damage'
          ? `deal ${e.amount} damage to it`
          : e.type === 'destroyIfAtMost'
            ? `destroy it if its PL is ${e.amount} or less`
            : 'cancel the attack';
      lines.push(`${when}, ${what}.`);
      break;
    }
  }
  return lines;
}
