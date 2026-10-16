import { ALL_CARDS, getCard } from '../engine/cards';
import { copyLimit, countCards, deckProblems, deckWarnings, mainTypes, STARTER_DECKS } from '../engine/decks';
import { DECK_SIZE } from '../engine/rules';
import type { Card } from '../engine/types';
import { cardFace, esc, typeChips } from './render';

export interface BuilderState {
  /** Null until the deck is first saved. */
  id: string | null;
  name: string;
  cards: string[];
  filter: string;
  dirty: boolean;
}

const TYPE_ORDER = ['Goblin', 'Undead', 'Elemental', 'Knight', 'Beast'];
const KIND_ORDER = ['creature', 'spell', 'relic', 'trap'];
const FILTERS = [
  ['all', 'All'],
  ...TYPE_ORDER.map((t) => [t, t]),
  ['spell', 'Spells'],
  ['relic', 'Relics'],
  ['trap', 'Traps'],
] as const;

function sortKey(card: Card): [number, number, number, number] {
  const kind = KIND_ORDER.indexOf(card.kind);
  if (card.kind !== 'creature') return [kind, 0, 0, card.cost];
  return [kind, TYPE_ORDER.indexOf(card.type), card.legendary ? 4 : card.stars, card.cost];
}

function compareCards(a: Card, b: Card): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return a.name.localeCompare(b.name);
}

function matchesFilter(card: Card, filter: string): boolean {
  if (filter === 'all') return true;
  return card.kind === 'creature' ? card.type === filter : card.kind === filter;
}

function costCurve(cards: string[]): string {
  const buckets = Array.from({ length: 8 }, () => 0);
  for (const id of cards) buckets[Math.min(getCard(id).cost, 8) - 1]++;
  const max = Math.max(1, ...buckets);
  return `
    <div class="curve" title="How many cards you have at each energy cost">
      ${buckets
        .map(
          (n, i) => `
        <div class="curve-col">
          <span class="curve-n">${n || ''}</span>
          <div class="curve-bar" style="height:${(n / max) * 48}px"></div>
          <span class="curve-cost">${i === 7 ? '8+' : i + 1}</span>
        </div>`,
        )
        .join('')}
    </div>`;
}

export function renderBuilder(b: BuilderState): string {
  const counts = countCards(b.cards);
  const pool = ALL_CARDS.filter((c) => matchesFilter(c, b.filter))
    .sort(compareCards)
    .map((card) => {
      const n = counts.get(card.id) ?? 0;
      const limit = copyLimit(card.id);
      const classes = ['pool-card', n >= limit || b.cards.length >= DECK_SIZE ? 'maxed' : 'playable'];
      const badge = `<span class="count-badge ${n ? 'some' : ''}">${n}/${limit}</span>`;
      return cardFace(card, classes, `data-action="builder-add" data-card="${card.id}"`, badge);
    })
    .join('');

  const filters = FILTERS.map(
    ([value, label]) =>
      `<button class="filter ${b.filter === value ? 'on' : ''}" data-action="builder-filter" data-filter="${value}">${label}</button>`,
  ).join('');

  const rows = [...counts.entries()]
    .map(([id, n]) => ({ card: getCard(id), n }))
    .sort((x, y) => x.card.cost - y.card.cost || compareCards(x.card, y.card))
    .map(
      ({ card, n }) => `
      <button class="deck-row-item" data-action="builder-remove" data-card="${card.id}" title="Click to remove one">
        <span class="cost">${card.cost}</span>
        <span class="row-name">${esc(card.name)}</span>
        <span class="row-count">×${n}</span>
        <span class="row-minus">−</span>
      </button>`,
    )
    .join('');

  const problems = deckProblems(b.cards).filter((p) => !p.startsWith('A deck needs'));
  const warnings = deckWarnings(b.cards);
  const complete = b.cards.length === DECK_SIZE;
  const templates = STARTER_DECKS.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

  return `
    <div class="builder">
      <div class="builder-head">
        <input class="deck-name-input" data-input="builder-name" value="${esc(b.name)}" maxlength="30" aria-label="Deck name" />
        <select data-change="builder-template" aria-label="Start from a starter deck">
          <option value="">Copy a starter deck…</option>${templates}
        </select>
        <button data-action="builder-save">${b.dirty ? 'Save' : 'Saved ✓'}</button>
        <button data-action="builder-back" class="secondary">Back</button>
      </div>
      <div class="builder-body">
        <section class="pool">
          <div class="filters">${filters}</div>
          <div class="pool-grid" id="pool-grid">${pool}</div>
        </section>
        <aside class="decklist">
          <div class="deck-count ${complete ? 'complete' : ''}">${b.cards.length} / ${DECK_SIZE} cards</div>
          <div class="deck-types">${typeChips(mainTypes(b.cards))}</div>
          ${costCurve(b.cards)}
          ${[...problems.map((p) => `<div class="note problem">⛔ ${esc(p)}</div>`), ...warnings.map((w) => `<div class="note warning">⚠️ ${esc(w)}</div>`)].join('')}
          <div class="deck-rows" id="deck-rows">${rows || '<p class="small">Click cards on the left to add them.</p>'}</div>
          ${b.cards.length ? '<button class="secondary small-btn" data-action="builder-clear">Remove all cards</button>' : ''}
        </aside>
      </div>
    </div>`;
}
