import { cardText, creatureCard, getCard, isDirectlyPlayable } from '../engine/cards';
import { STARTER_DECKS, type DeckDef } from '../engine/decks';
import { attackTargets, hasKeyword, keywordsOf, LANES, other, power, synergyActive } from '../engine/game';
import { CRYSTAL_HP, LANE_NAMES } from '../engine/rules';
import { RIVALS, type Rival } from '../engine/rivals';
import type { Card, Creature, GameState, LaneIndex, PlayerId, Row } from '../engine/types';

export interface GameView {
  state: GameState;
  me: PlayerId;
  /** Target keys to highlight: `c:player:lane:row` for creatures, `l:player:lane` for lanes. */
  targets: Set<string>;
  selectedHand: number | null;
  selectedCreature: { lane: LaneIndex; row: Row } | null;
  playableHand: Set<number>;
  hint: string;
  rival: Rival;
  /** What the rival is currently saying, if anything. */
  speech: string | null;
  speechFresh: boolean;
  /** What the card details panel shows: `c:player:lane:row` for a creature, `card:id` for a card. */
  inspect: string | null;
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export const stars = (n: number) => '★'.repeat(n);

export function cardTitle(card: Card): string {
  const lines = [card.name, `Cost ${card.cost}`];
  if (card.kind === 'creature') {
    lines.push(`${stars(card.stars)} ${card.type} · PL ${card.power}`);
    if (card.keywords.length) lines.push(card.keywords.join(', '));
  } else {
    lines.push(card.kind[0].toUpperCase() + card.kind.slice(1));
  }
  return esc([...lines, ...cardText(card)].join('\n'));
}

// ---------- Menu ----------

export const typeChips = (types: string[]) =>
  types.map((t) => `<span class="type-chip type-${t.toLowerCase()}">${t}</span>`).join('');

function deckButton(d: DeckDef, problems: string[] = []): string {
  const disabled = problems.length > 0;
  return `
    <button class="deck-choice" data-action="choose-deck" data-deck="${d.id}" ${disabled ? 'disabled' : ''}>
      <span class="deck-name">${esc(d.name)}</span>
      <span class="deck-types">${typeChips(d.types)}</span>
      <span class="deck-desc">${esc(disabled ? problems[0] : d.description)}</span>
    </button>`;
}

export function renderMenu(chosenDeck: DeckDef | null, customDecks: { deck: DeckDef; problems: string[] }[]): string {
  if (!chosenDeck) {
    const custom = customDecks
      .map(
        ({ deck, problems }) => `
        <div class="custom-deck">
          ${deckButton(deck, problems)}
          <div class="custom-actions">
            <button class="secondary small-btn" data-action="edit-deck" data-deck="${deck.id}">Edit</button>
            <button class="secondary small-btn" data-action="delete-deck" data-deck="${deck.id}">Delete</button>
          </div>
        </div>`,
      )
      .join('');
    return `
      <div class="menu">
        <h1>Card Battler</h1>
        <p class="tagline">Prototype v0.1 — destroy 2 of your rival's 3 crystals to win.</p>
        <h2>1. Choose your deck</h2>
        <h3>Your decks</h3>
        <div class="deck-list">${custom || '<p class="small">No custom decks yet.</p>'}</div>
        <div class="buttons menu-buttons"><button data-action="new-deck">➕ Build a new deck</button></div>
        <h3>Starter decks</h3>
        <div class="deck-list">${STARTER_DECKS.map((d) => deckButton(d)).join('')}</div>
        <p class="small">Hover over any card in a game to read it in full.</p>
      </div>`;
  }

  const rivals = RIVALS.map((r) => {
    const deck = STARTER_DECKS.find((d) => d.id === r.deckId)!;
    return `
      <button class="deck-choice rival-choice" data-action="choose-rival" data-rival="${r.id}">
        <span class="portrait">${r.portrait}</span>
        <span class="rival-info">
          <span class="deck-name">${esc(r.name)} <span class="rival-title">· ${esc(r.title)}</span></span>
          <span class="deck-desc">${esc(r.style)}</span>
          <span class="rival-deck">${esc(deck.name)} ${typeChips(deck.types)}</span>
        </span>
      </button>`;
  }).join('');
  return `
    <div class="menu">
      <h1>Card Battler</h1>
      <p class="tagline">Your deck: <b>${esc(chosenDeck.name)}</b> ${typeChips(chosenDeck.types)}</p>
      <h2>2. Choose your rival</h2>
      <div class="deck-list">${rivals}</div>
      <div class="buttons menu-buttons">
        <button data-action="random-rival">🎲 Random rival</button>
        <button data-action="back" class="secondary">Back</button>
      </div>
    </div>`;
}

// ---------- Cards ----------

/** A full-size card, as shown in your hand and in the deck builder. */
export function cardFace(card: Card, extraClasses: string[], attrs: string, badge = ''): string {
  const classes = ['card', 'hand-card', `kind-${card.kind}`, ...extraClasses];
  if (card.kind === 'creature') classes.push(`type-${card.type.toLowerCase()}`);
  let ribbon = '';
  let text = cardText(card);
  if (card.kind === 'creature' && !isDirectlyPlayable(card)) {
    classes.push('evolution');
    ribbon = '<div class="ribbon evolve">⬆ Evolution</div>';
  } else if (card.kind === 'creature' && card.legendary) {
    classes.push('legendary');
    ribbon = '<div class="ribbon legend">👑 Legendary</div>';
    text = text.filter((line) => line !== 'Legendary');
  }
  const meta =
    card.kind === 'creature'
      ? `<div class="meta">${stars(card.stars)} ${card.type}</div><div class="pl">${card.power}</div>
         ${card.keywords.length ? `<div class="kw">${card.keywords.join(' · ')}</div>` : ''}`
      : `<div class="meta">${card.kind}</div>`;
  return `
    <div class="${classes.join(' ')}" ${attrs} title="${cardTitle(card)}">
      ${badge}
      <div class="card-top"><span class="cost">${card.cost}</span><span class="name">${esc(card.name)}</span></div>
      ${ribbon}
      ${meta}
      <div class="text">${text.map(esc).join('<br>')}</div>
    </div>`;
}

function handCard(card: Card, index: number, view: GameView): string {
  const classes: string[] = [];
  if (view.playableHand.has(index)) classes.push('playable');
  if (view.selectedHand === index) classes.push('selected');
  return cardFace(card, classes, `data-action="hand" data-index="${index}"`);
}

function creatureStatus(state: GameState, player: PlayerId, lane: LaneIndex, row: Row, c: Creature): string {
  const icons: string[] = [];
  if (c.shield) icons.push('<span title="Shield ready">🛡️</span>');
  if (c.stack.length) {
    const from = c.stack.map((id) => getCard(id).name).join(' → ');
    icons.push(`<span title="Evolved from ${esc(from)}">⬆</span>`);
  }
  if (c.equipment) icons.push(`<span title="${esc(getCard(c.equipment).name)}">🗡️</span>`);
  if (synergyActive(state.players[player].lanes[lane], row)) icons.push('<span title="Synergy active">🔗</span>');
  if (player === state.active && state.phase !== 'over') {
    if (c.attackedTurn === state.turn) icons.push('<span title="Already attacked">✔️</span>');
    else if (c.playedTurn === state.turn && !hasKeyword(c, 'Rush')) icons.push('<span title="Just played: can attack next turn">💤</span>');
    else if (attackTargets(state, player, lane, row).length) icons.push('<span title="Ready to attack">⚔️</span>');
  }
  return icons.join('');
}

function boardCreature(state: GameState, player: PlayerId, lane: LaneIndex, row: Row, c: Creature): string {
  const card = creatureCard(c.cardId);
  const pl = power(c);
  const plClass = c.damage > 0 ? 'hurt' : c.buff > 0 ? 'boost' : '';
  const keywords = keywordsOf(c);
  return `
    <div class="card board-card type-${card.type.toLowerCase()}" title="${cardTitle(card)}">
      <div class="card-top"><span class="name">${esc(card.name)}</span><span class="status">${creatureStatus(state, player, lane, row, c)}</span></div>
      <div class="board-body">
        <div class="pl ${plClass}">${pl}</div>
        <div><div class="meta">${stars(card.stars)} ${card.type}</div>${keywords.length ? `<div class="kw">${keywords.join(' · ')}</div>` : ''}</div>
      </div>
    </div>`;
}

// ---------- Board ----------

function slot(view: GameView, player: PlayerId, lane: LaneIndex, row: Row): string {
  const { state } = view;
  const side = state.players[player].lanes[lane];
  const c = side[row];
  const classes = ['cell', 'slot', row];
  if (view.targets.has(`l:${player}:${lane}`)) classes.push('lane-target');
  if (c && view.targets.has(`c:${player}:${lane}:${row}`)) classes.push('target');
  if (player === view.me && view.selectedCreature?.lane === lane && view.selectedCreature.row === row) classes.push('selected');
  const content = c
    ? boardCreature(state, player, lane, row, c)
    : `<span class="empty-label">${row}</span>`;
  const inspect = c ? `data-inspect="c:${player}:${lane}:${row}"` : '';
  return `<div class="${classes.join(' ')}" data-action="cell" data-player="${player}" data-lane="${lane}" data-row="${row}" ${inspect}>${content}</div>`;
}

function crystal(view: GameView, player: PlayerId, lane: LaneIndex): string {
  const side = view.state.players[player].lanes[lane];
  const classes = ['cell', 'crystal'];
  if (side.destroyed) classes.push('destroyed');
  if (view.targets.has(`l:${player}:${lane}`)) classes.push('lane-target');
  const pct = Math.round((side.crystal / CRYSTAL_HP) * 100);
  const trap = side.trap
    ? player === view.me
      ? `<span class="tag trap" data-inspect="card:${side.trap.cardId}" title="${cardTitle(getCard(side.trap.cardId))}">🪤 ${esc(getCard(side.trap.cardId).name)}</span>`
      : '<span class="tag trap" title="A face-down trap">🪤 Trap</span>'
    : '';
  const relic = side.relic
    ? `<span class="tag relic" data-inspect="card:${side.relic}" title="${cardTitle(getCard(side.relic))}">🏺 ${esc(getCard(side.relic).name)}</span>`
    : '';
  const body = side.destroyed
    ? '<span class="crystal-hp">💥 Destroyed</span>'
    : `<span class="crystal-hp">💎 ${side.crystal}</span><span class="bar"><span style="width:${pct}%"></span></span>`;
  return `
    <div class="${classes.join(' ')}" data-action="cell" data-player="${player}" data-lane="${lane}" data-row="crystal">
      <div class="crystal-line"><span class="lane-label">${LANE_NAMES[lane]}</span>${body}</div><div class="tags">${trap}${relic}</div>
    </div>`;
}

function sideRows(view: GameView, player: PlayerId, top: boolean): string {
  const rows = [
    `<div class="row">${LANES.map((l) => crystal(view, player, l)).join('')}</div>`,
    `<div class="row">${LANES.map((l) => slot(view, player, l, 'back')).join('')}</div>`,
    `<div class="row">${LANES.map((l) => slot(view, player, l, 'front')).join('')}</div>`,
  ];
  return `<div class="side ${top ? 'enemy' : 'mine'}">${(top ? rows : rows.reverse()).join('')}</div>`;
}

function playerBar(state: GameState, player: PlayerId, isMe: boolean, view: GameView): string {
  const p = state.players[player];
  const pips = Array.from({ length: p.maxEnergy }, (_, i) => `<span class="pip ${i < p.energy ? 'on' : ''}"></span>`).join('');
  const active = state.active === player && state.phase !== 'mulligan' && state.phase !== 'over';
  return `
    <div class="player-bar ${active ? 'active' : ''} ${isMe ? '' : 'enemy-bar'}">
      <span class="pname">${isMe ? '🧑 ' : `<span class="bar-portrait">${view.rival.portrait}</span>`}${esc(p.name)}</span>
      <span class="energy" title="Energy">⚡ ${p.energy}/${p.maxEnergy} <span class="pips">${pips}</span></span>
      <span title="Cards in deck">🂠 ${p.deck.length}</span>
      ${isMe ? '' : `<span title="Cards in hand">✋ ${p.hand.length}</span>`}
      <span title="Discard pile">🗑 ${p.discard.length}</span>
      ${p.fatigue ? `<span title="Fatigue">🥀 ${p.fatigue}</span>` : ''}
      ${!isMe && view.speech ? `<div class="speech ${view.speechFresh ? 'pop' : ''}">${esc(view.speech)}</div>` : ''}
    </div>`;
}

// ---------- Overlays ----------

function overlay(view: GameView): string {
  const { state, me } = view;
  if (state.phase === 'mulligan' && !state.players[me].mulliganDone) {
    const cards = state.players[me].hand
      .map((id, i) => handCard(getCard(id), i, { ...view, playableHand: new Set(), selectedHand: null }))
      .join('');
    const first = state.firstPlayer === me ? 'You go first (no draw and no attacks on your first turn).' : 'You go second (you draw on your first turn).';
    return `
      <div class="overlay"><div class="dialog">
        <h2>Your starting hand</h2>
        <p>${first}</p>
        <div class="mulligan-hand">${cards}</div>
        <p>Keep this hand, or shuffle it back and draw 5 new cards? You can only redraw once.</p>
        <div class="buttons">
          <button data-action="keep">Keep</button>
          <button data-action="redraw" class="secondary">Redraw</button>
        </div>
      </div></div>`;
  }
  if (state.phase === 'over') {
    const won = state.winner === me;
    return `
      <div class="overlay"><div class="dialog">
        <h2>${won ? '🏆 Victory!' : '💀 Defeat'}</h2>
        <p>${won ? 'You destroyed two of their crystals.' : `${esc(state.players[other(me)].name)} destroyed two of your crystals.`}</p>
        ${view.speech ? `<p class="parting"><span class="portrait">${view.rival.portrait}</span> “${esc(view.speech)}”</p>` : ''}
        <div class="buttons">
          <button data-action="rematch">Rematch</button>
          <button data-action="menu" class="secondary">Change deck or rival</button>
        </div>
      </div></div>`;
  }
  return '';
}

// ---------- Card details ----------

/** The card details panel: the full card, plus the current state of a creature on the board. */
export function renderInspector(state: GameState, key: string | null): string {
  const empty = '<p class="small">Hover over or tap a card on the board to see its details.</p>';
  if (!key) return empty;
  if (key.startsWith('card:')) return cardFace(getCard(key.slice(5)), ['inspect-card'], '');

  const [, p, l, row] = key.split(':');
  const player = Number(p) as PlayerId;
  const lane = Number(l) as LaneIndex;
  const side = state.players[player].lanes[lane];
  const c = side[row as Row];
  if (!c) return empty;
  const card = creatureCard(c.cardId);

  const facts: string[] = [];
  const parts = [`base ${card.power}`];
  if (c.buff) parts.push(`+${c.buff} boosted`);
  if (c.damage) parts.push(`−${c.damage} damage`);
  facts.push(`Power Level <b>${power(c)}</b> (${parts.join(', ')})`);
  if (c.stack.length) facts.push(`Evolved from ${c.stack.map((id) => esc(getCard(id).name)).join(' → ')}`);
  if (c.equipment) {
    const relic = getCard(c.equipment);
    facts.push(`Equipped: <b>${esc(relic.name)}</b> (${esc(cardText(relic).join(' '))})`);
  }
  if (c.granted.length) facts.push(`Granted: ${c.granted.join(', ')}`);
  if (keywordsOf(c).includes('Shield')) facts.push(c.shield ? '🛡️ Shield ready' : 'Shield used up');
  if (card.synergy) facts.push(synergyActive(side, row as Row) ? '🔗 Synergy active' : 'Synergy inactive (needs a matching partner in this lane)');
  if (player === state.active && state.phase !== 'over') {
    if (c.attackedTurn === state.turn) facts.push('Has attacked this turn');
    else if (c.playedTurn === state.turn && !hasKeyword(c, 'Rush')) facts.push('💤 Just played: can attack next turn');
  }
  return `
    ${cardFace(card, ['inspect-card'], '')}
    <ul class="facts">${facts.map((f) => `<li>${f}</li>`).join('')}</ul>`;
}

// ---------- Game ----------

/** The engine logs in the third person; rewrite the human player's lines ("You plays" → "You play"). */
function formatLog(line: string): string {
  if (!line.includes('You')) return line;
  return line
    .replace(/\bYou's\b/g, 'Your')
    .replace(/\bYou goes\b/g, 'You go')
    .replace(/\bYou (\w+?)s\b/g, 'You $1')
    .replace(/\bYou (.*)\btheir\b/g, 'You $1your');
}

export function renderGame(view: GameView): string {
  const { state, me } = view;
  const opp = other(me);
  const myTurn = state.active === me && (state.phase === 'main' || state.phase === 'combat');
  const phaseText =
    state.phase === 'mulligan'
      ? 'Mulligan'
      : state.phase === 'over'
        ? 'Game over'
        : `Turn ${state.turn} · ${state.active === me ? 'Your' : `${esc(state.players[opp].name)}'s`} ${state.phase} phase`;
  const hand = state.players[me].hand.map((id, i) => handCard(getCard(id), i, view)).join('');
  const log = state.log
    .slice(-150)
    .map((line) => `<div class="${line.startsWith('—') ? 'turn-line' : ''}">${esc(formatLog(line))}</div>`)
    .join('');

  return `
    <div class="game">
      <section class="board-area">
        ${playerBar(state, opp, false, view)}
        ${sideRows(view, opp, true)}
        <div class="divider">${phaseText}</div>
        ${sideRows(view, me, false)}
        ${playerBar(state, me, true, view)}
      </section>
      <aside class="sidebar">
        <div class="hint">${view.hint}</div>
        <button data-action="end-turn" ${myTurn ? '' : 'disabled'}>End turn</button>
        <div class="inspector" id="inspector">${renderInspector(state, view.inspect)}</div>
        <div class="log" id="log">${log}</div>
        <button data-action="menu" class="secondary small-btn">Quit to menu</button>
      </aside>
      <section class="hand">${hand || '<span class="small">Your hand is empty.</span>'}</section>
      ${overlay(view)}
    </div>`;
}
