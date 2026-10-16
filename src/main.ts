import './style.css';
import { chooseAction, chooseMulligan } from './engine/ai';
import { creatureCard, getCard, isDirectlyPlayable } from './engine/cards';
import { copyLimit, deckProblems, STARTER_DECKS, type DeckDef } from './engine/decks';
import { applyAction, createGame, getLegalActions, isExposed, other, power } from './engine/game';
import { pickLine, RIVALS, type LineKey, type Rival } from './engine/rivals';
import type { Action, GameEvent, GameState, LaneIndex, PlayerId, Row, Target } from './engine/types';
import { DECK_SIZE } from './engine/rules';
import { loadCustomDecks, saveCustomDecks, toDeckDef, type CustomDeck } from './storage';
import { renderBuilder, type BuilderState } from './ui/builder';
import { playEffects } from './ui/effects';
import { renderGuide } from './ui/guide';
import { renderGame, renderInspector, renderMenu, type GameView } from './ui/render';

const ME: PlayerId = 0;
const RIVAL: PlayerId = 1;
const AI_DELAY_MS = 850;
/** The rival pauses longer after a spell, relic or trap so you can read the card. */
const AI_REVEAL_DELAY_MS = 1800;
const SPEECH_MS = 4500;

type Selection = { kind: 'hand'; index: number } | { kind: 'creature'; lane: LaneIndex; row: Row } | null;

const root = document.querySelector<HTMLDivElement>('#app')!;
let state: GameState | null = null;
let chosenDeck: DeckDef | null = null;
let rival: Rival | null = null;
let speech: string | null = null;
/** True only for the first render after a new line, so the bubble animates once. */
let speechFresh = false;
let speechTimer: number | null = null;
let seenEvents = 0;
let animatedEvents = 0;
let lastActionRevealed = false;
let inspectKey: string | null = null;
let showGuide = firstVisit();

/** Show the guide automatically on someone's first visit. */
function firstVisit(): boolean {
  try {
    if (localStorage.getItem('card-battler.seen-guide')) return false;
    localStorage.setItem('card-battler.seen-guide', '1');
    return true;
  } catch {
    return false;
  }
}
let customDecks: CustomDeck[] = loadCustomDecks();
let builder: BuilderState | null = null;
let selection: Selection = null;
let message = '';
let aiTimer: number | null = null;

// ---------- Targets ----------

const targetKey = (t: Target) => (t.kind === 'creature' ? `c:${t.player}:${t.lane}:${t.row}` : `l:${t.player}:${t.lane}`);

/** The board position a player clicks to choose this action ('none' for untargeted spells). */
function actionKey(a: Action, me: PlayerId): string | null {
  switch (a.type) {
    case 'playCreature':
    case 'setTrap':
      return `l:${me}:${a.lane}`;
    case 'evolve':
      return `c:${me}:${a.lane}:${a.row}`;
    case 'castSpell':
      return a.target ? targetKey(a.target) : 'none';
    case 'playRelic':
      return targetKey(a.target);
    case 'move':
      return `l:${me}:${a.toLane}`;
    case 'attack':
      return `l:${other(me)}:${a.targetLane}`;
    default:
      return null;
  }
}

function actionsFor(sel: Selection, legal: Action[]): Action[] {
  if (!sel) return [];
  if (sel.kind === 'hand') return legal.filter((a) => 'handIndex' in a && a.handIndex === sel.index);
  return legal.filter((a) => (a.type === 'move' || a.type === 'attack') && a.lane === sel.lane && a.row === sel.row);
}

function isMyTurn(): boolean {
  return !!state && state.active === ME && (state.phase === 'main' || state.phase === 'combat');
}

// ---------- Hints ----------

function hintFor(legal: Action[]): string {
  if (!state) return '';
  if (message) return message;
  if (state.phase === 'over') return 'Game over.';
  if (state.phase === 'mulligan') return 'Keep or redraw your starting hand.';
  if (!isMyTurn()) return `🤖 ${state.players[RIVAL].name} is thinking…`;

  const actions = actionsFor(selection, legal);
  if (selection?.kind === 'hand') {
    const card = getCard(state.players[ME].hand[selection.index]);
    if (actions.some((a) => a.type === 'castSpell' && !a.target)) return `Click <b>${card.name}</b> again to cast it.`;
    const parts: string[] = [];
    if (actions.some((a) => a.type === 'playCreature')) parts.push('choose one of your lanes to play it');
    if (actions.some((a) => a.type === 'evolve')) parts.push('choose a highlighted creature to evolve');
    if (actions.some((a) => a.type === 'castSpell' || a.type === 'playRelic')) parts.push('choose a highlighted target');
    if (actions.some((a) => a.type === 'setTrap')) parts.push('choose one of your lanes to set it face-down');
    return `<b>${card.name}</b>: ${parts.join(', or ')}.`;
  }
  if (selection?.kind === 'creature') {
    const parts: string[] = [];
    if (actions.some((a) => a.type === 'attack')) parts.push('choose a highlighted enemy lane to attack');
    if (actions.some((a) => a.type === 'move')) parts.push('choose an empty slot in an adjacent lane to move (1 energy)');
    return parts.join(', or ') + '.';
  }
  return state.phase === 'main'
    ? 'Your turn. Select a card or creature. Attacking ends your main phase, so play cards first.'
    : 'Combat phase: attack with your ready creatures (⚔️), then end your turn.';
}

// ---------- Attack preview ----------

/** Describe what an attack would do, by trying it on a copy of the game (without enemy traps). */
function previewAttack(action: Extract<Action, { type: 'attack' }>): string {
  if (!state) return '';
  const sim: GameState = structuredClone({ ...state, log: [], events: [] });
  const enemy = sim.players[RIVAL].lanes[action.targetLane];
  const realTrap = state.players[RIVAL].lanes[action.targetLane].trap;
  enemy.trap = null;
  const attacker = state.players[ME].lanes[action.lane][action.row]!;
  const front = state.players[RIVAL].lanes[action.targetLane].front;
  const back = state.players[RIVAL].lanes[action.targetLane].back;
  const crystalBefore = enemy.crystal;
  applyAction(sim, action);

  const after = (uid: number, player: PlayerId) => {
    for (const side of sim.players[player].lanes) for (const c of [side.front, side.back]) if (c?.uid === uid) return power(c);
    return 0;
  };
  const change = (name: string, before: number, now: number) =>
    now <= 0 ? `<b>${name}</b> is destroyed` : now === before ? `<b>${name}</b> stays at ${now}` : `<b>${name}</b> ${before} → ${now}`;
  const name = (id: string) => getCard(id).name;

  const lines: string[] = [];
  const ranged = action.row === 'back';
  if (front && !ranged) {
    lines.push(
      isExposed(state, RIVAL, front)
        ? `${name(front.cardId)} is <b>Exposed</b>: you strike first.`
        : `${name(front.cardId)} is <b>Guarding</b>: it strikes first.`,
    );
  }
  lines.push(change(name(attacker.cardId), power(attacker), after(attacker.uid, ME)));
  if (front) lines.push(change(name(front.cardId), power(front), after(front.uid, RIVAL)));
  if (back && after(back.uid, RIVAL) !== power(back)) lines.push(change(name(back.cardId), power(back), after(back.uid, RIVAL)));
  const crystalDamage = crystalBefore - sim.players[RIVAL].lanes[action.targetLane].crystal;
  if (crystalDamage > 0) lines.push(`Their crystal takes <b>${crystalDamage}</b>`);
  if (realTrap) lines.push('⚠️ A face-down trap is set in this lane.');
  return `⚔️ <b>If you attack:</b><br>${lines.join('<br>')}`;
}

// ---------- Rendering ----------

/** Replace the page while keeping the scroll position of scrollable panels. */
function replacePage(html: string) {
  const scrolls = ['pool-grid', 'deck-rows'].map((id) => [id, document.getElementById(id)?.scrollTop ?? 0] as const);
  const pageY = window.scrollY;
  root.innerHTML = html + (showGuide ? renderGuide() : '');
  for (const [id, top] of scrolls) {
    const el = document.getElementById(id);
    if (el) el.scrollTop = top;
  }
  window.scrollTo(0, pageY);
}

function render() {
  if (builder) {
    replacePage(renderBuilder(builder));
    return;
  }
  if (!state || !rival) {
    const custom = customDecks.map((d) => ({ deck: toDeckDef(d), problems: deckProblems(d.cards) }));
    replacePage(renderMenu(chosenDeck, custom));
    return;
  }
  const legal = isMyTurn() ? getLegalActions(state) : [];
  const targets = new Set(actionsFor(selection, legal).map((a) => actionKey(a, ME)).filter((k): k is string => !!k));
  const playableHand = new Set(legal.flatMap((a) => ('handIndex' in a ? [a.handIndex] : [])));
  const view: GameView = {
    state,
    me: ME,
    targets,
    selectedHand: selection?.kind === 'hand' ? selection.index : null,
    selectedCreature: selection?.kind === 'creature' ? selection : null,
    playableHand,
    hint: hintFor(legal),
    rival,
    speech,
    speechFresh,
    inspect: inspectKey,
  };
  root.innerHTML = renderGame(view);
  speechFresh = false;
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
}

// ---------- Game flow ----------

// ---------- Rival dialogue ----------

function say(text: string) {
  speech = text;
  speechFresh = true;
  if (speechTimer) clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => {
    speechTimer = null;
    // Keep the parting line on the game-over screen.
    if (state?.phase === 'over') return;
    speech = null;
    render();
  }, SPEECH_MS);
}

/** Which line (if any) the rival says about one event. Lower numbers are more important. */
function reaction(e: GameEvent): { key: LineKey; priority: number; chance: number } | null {
  const mine = e.player === RIVAL;
  switch (e.type) {
    case 'win':
      return { key: mine ? 'win' : 'lose', priority: 0, chance: 1 };
    case 'crystalDestroyed':
      return { key: mine ? 'lostCrystal' : 'tookCrystal', priority: 1, chance: 1 };
    case 'trap':
      return { key: mine ? 'trapSprung' : 'fellForTrap', priority: 2, chance: 1 };
    case 'play':
      return creatureCard(e.cardId).legendary ? { key: mine ? 'playLegendary' : 'playerLegendary', priority: 3, chance: 1 } : null;
    case 'evolve':
      return mine ? { key: 'evolve', priority: 4, chance: 0.6 } : null;
    case 'turnStart':
      return mine ? { key: 'taunt', priority: 5, chance: 0.2 } : null;
    default:
      return null;
  }
}

/** Let the rival react to the most important thing that happened since last time. */
function reactToEvents() {
  if (!state || !rival) return;
  const fresh = state.events.slice(seenEvents);
  seenEvents = state.events.length;
  const best = fresh
    .map(reaction)
    .filter((r): r is NonNullable<typeof r> => !!r && Math.random() < r.chance)
    .sort((a, b) => a.priority - b.priority)[0];
  // Minor chatter (evolutions, taunts) never interrupts a line that is still showing.
  if (best && (!speech || best.priority < 4)) say(pickLine(rival, best.key));
}

// ---------- Game flow ----------

function startGame(mine: DeckDef, opponent: Rival) {
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = null;
  chosenDeck = mine;
  rival = opponent;
  selection = null;
  message = '';
  const rivalDeck = STARTER_DECKS.find((d) => d.id === opponent.deckId)!;
  state = createGame([
    { name: 'You', deck: mine.cards, isAI: false },
    { name: opponent.name, deck: rivalDeck.cards, isAI: true },
  ]);
  applyAction(state, { type: 'mulligan', player: RIVAL, redraw: chooseMulligan(state, RIVAL) });
  seenEvents = state.events.length;
  animatedEvents = state.events.length;
  inspectKey = null;
  say(pickLine(opponent, 'intro'));
  render();
}

function quitToMenu() {
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = null;
  state = null;
  rival = null;
  speech = null;
  render();
}

/** Animate everything that happened since the last animation. Call after rendering. */
function animate() {
  if (!state) return;
  const names = state.players.map((p) => p.name);
  lastActionRevealed = playEffects(state.events.slice(animatedEvents), ME, names);
  animatedEvents = state.events.length;
}

function perform(action: Action) {
  if (!state) return;
  applyAction(state, action);
  selection = null;
  message = '';
  reactToEvents();
  render();
  animate();
  scheduleAI();
}

function scheduleAI() {
  if (!state || aiTimer || state.active !== RIVAL || (state.phase !== 'main' && state.phase !== 'combat')) return;
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    if (!state || state.active !== RIVAL) return;
    applyAction(state, chooseAction(state, RIVAL, rival?.profile));
    reactToEvents();
    render();
    animate();
    scheduleAI();
  }, lastActionRevealed ? AI_REVEAL_DELAY_MS : AI_DELAY_MS);
}

// ---------- Deck builder ----------

function openBuilder(deck: CustomDeck | null) {
  builder = deck
    ? { id: deck.id, name: deck.name, cards: [...deck.cards], filter: 'all', dirty: false }
    : { id: null, name: `My Deck ${customDecks.length + 1}`, cards: [], filter: 'all', dirty: true };
  render();
}

function saveBuilder() {
  if (!builder) return;
  const deck: CustomDeck = { id: builder.id ?? `custom-${Date.now()}`, name: builder.name.trim() || 'Untitled deck', cards: [...builder.cards] };
  const index = customDecks.findIndex((d) => d.id === deck.id);
  if (index >= 0) customDecks[index] = deck;
  else customDecks.push(deck);
  saveCustomDecks(customDecks);
  builder.id = deck.id;
  builder.name = deck.name;
  builder.dirty = false;
  render();
}

function closeBuilder() {
  if (builder?.dirty && !window.confirm('Leave without saving your changes?')) return;
  builder = null;
  render();
}

function builderAdd(cardId: string) {
  if (!builder || builder.cards.length >= DECK_SIZE) return;
  if (builder.cards.filter((id) => id === cardId).length >= copyLimit(cardId)) return;
  builder.cards.push(cardId);
  builder.dirty = true;
  render();
}

function builderRemove(cardId: string) {
  if (!builder) return;
  const index = builder.cards.lastIndexOf(cardId);
  if (index < 0) return;
  builder.cards.splice(index, 1);
  builder.dirty = true;
  render();
}

// ---------- Input ----------

function onHandClick(index: number) {
  if (!state || !isMyTurn()) return;
  const legal = getLegalActions(state);
  message = '';
  if (selection?.kind === 'hand' && selection.index === index) {
    const cast = legal.find((a) => a.type === 'castSpell' && a.handIndex === index && !a.target);
    if (cast) return perform(cast);
    selection = null;
  } else if (actionsFor({ kind: 'hand', index }, legal).length) {
    selection = { kind: 'hand', index };
  } else {
    const card = getCard(state.players[ME].hand[index]);
    selection = null;
    message =
      card.cost > state.players[ME].energy
        ? `Not enough energy for <b>${card.name}</b>.`
        : state.phase === 'combat'
          ? 'Cards can only be played before you attack.'
          : card.kind === 'creature' && !isDirectlyPlayable(card)
            ? `<b>${card.name}</b> evolves from a ${card.stars - 1}★ ${card.type} on your field (each creature can evolve once per turn).`
            : `<b>${card.name}</b> has no valid target right now.`;
  }
  render();
}

function onCellClick(player: PlayerId, lane: LaneIndex, row: Row | 'crystal') {
  if (!state || !isMyTurn()) return;
  const legal = getLegalActions(state);
  const side = state.players[player].lanes[lane];
  const slotRow = row === 'crystal' ? null : row;
  const creatureHere = slotRow ? side[slotRow] : null;
  message = '';

  // Clicking one of your own creatures while a creature is selected switches the selection.
  const switchingCreature = selection?.kind === 'creature' && player === ME && creatureHere;
  if (selection && !switchingCreature) {
    const keys = [...(creatureHere ? [`c:${player}:${lane}:${slotRow}`] : []), `l:${player}:${lane}`];
    const actions = actionsFor(selection, legal);
    for (const key of keys) {
      const action = actions.find((a) => actionKey(a, ME) === key);
      if (action) return perform(action);
    }
  }

  if (player === ME && creatureHere && slotRow) {
    const sel: Selection = { kind: 'creature', lane, row: slotRow };
    const same = selection?.kind === 'creature' && selection.lane === lane && selection.row === slotRow;
    selection = !same && actionsFor(sel, legal).length ? sel : null;
    if (!same && !selection) message = 'That creature has nothing it can do right now.';
  } else {
    selection = null;
  }
  render();
}

root.addEventListener('click', (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  // Clicks inside the guide's dialog shouldn't fall through to the backdrop that closes it.
  if (action === 'close-guide' && el.classList.contains('guide-overlay') && (event.target as HTMLElement).closest('[data-stop]')) return;
  switch (action) {
    case 'open-guide':
    case 'close-guide':
      showGuide = action === 'open-guide';
      render();
      break;
    case 'choose-deck':
      chosenDeck = [...STARTER_DECKS, ...customDecks.map(toDeckDef)].find((d) => d.id === el.dataset.deck) ?? null;
      render();
      break;
    case 'new-deck':
      openBuilder(null);
      break;
    case 'edit-deck':
      openBuilder(customDecks.find((d) => d.id === el.dataset.deck) ?? null);
      break;
    case 'delete-deck': {
      const deck = customDecks.find((d) => d.id === el.dataset.deck);
      if (deck && window.confirm(`Delete "${deck.name}"? This can't be undone.`)) {
        customDecks = customDecks.filter((d) => d !== deck);
        saveCustomDecks(customDecks);
        render();
      }
      break;
    }
    case 'builder-add':
      builderAdd(el.dataset.card!);
      break;
    case 'builder-remove':
      builderRemove(el.dataset.card!);
      break;
    case 'builder-filter':
      if (builder) builder.filter = el.dataset.filter!;
      render();
      break;
    case 'builder-clear':
      if (builder && window.confirm('Remove every card from this deck?')) {
        builder.cards = [];
        builder.dirty = true;
        render();
      }
      break;
    case 'builder-save':
      saveBuilder();
      break;
    case 'builder-back':
      closeBuilder();
      break;
    case 'choose-rival':
      if (chosenDeck) startGame(chosenDeck, RIVALS.find((r) => r.id === el.dataset.rival)!);
      break;
    case 'random-rival':
      if (chosenDeck) startGame(chosenDeck, RIVALS[Math.floor(Math.random() * RIVALS.length)]);
      break;
    case 'back':
      chosenDeck = null;
      render();
      break;
    case 'keep':
    case 'redraw':
      perform({ type: 'mulligan', player: ME, redraw: action === 'redraw' });
      break;
    case 'hand':
      onHandClick(Number(el.dataset.index));
      break;
    case 'cell':
      onCellClick(Number(el.dataset.player) as PlayerId, Number(el.dataset.lane) as LaneIndex, el.dataset.row as Row | 'crystal');
      break;
    case 'end-turn':
      if (isMyTurn()) perform({ type: 'endTurn' });
      break;
    case 'rematch':
      if (chosenDeck && rival) startGame(chosenDeck, rival);
      break;
    case 'menu':
      quitToMenu();
      break;
  }
});

/** While one of your creatures is selected, hovering an enemy lane it can attack previews the result. */
function showAttackPreview(target: HTMLElement) {
  if (!state || selection?.kind !== 'creature' || !isMyTurn()) return;
  const cell = target.closest<HTMLElement>('[data-action="cell"]');
  const hint = root.querySelector('.hint');
  if (!cell || !hint || Number(cell.dataset.player) !== RIVAL) return;
  const sel = selection;
  const action = getLegalActions(state).find(
    (a): a is Extract<Action, { type: 'attack' }> =>
      a.type === 'attack' && a.lane === sel.lane && a.row === sel.row && a.targetLane === Number(cell.dataset.lane),
  );
  if (action) hint.innerHTML = previewAttack(action);
}

// Hovering (or tapping) a card on the board shows it in the details panel. Only the panel is
// updated, so the board isn't redrawn under the pointer.
root.addEventListener('mouseover', (event) => {
  showAttackPreview(event.target as HTMLElement);
  const el = (event.target as HTMLElement).closest<HTMLElement>('[data-inspect]');
  if (!el || !state || el.dataset.inspect === inspectKey) return;
  inspectKey = el.dataset.inspect!;
  const panel = document.getElementById('inspector');
  if (panel) panel.innerHTML = renderInspector(state, inspectKey);
});

root.addEventListener('input', (event) => {
  const el = event.target as HTMLInputElement;
  if (el.dataset.input === 'builder-name' && builder) {
    builder.name = el.value;
    builder.dirty = true;
    // Update the save button without re-rendering, which would lose the text cursor.
    const save = root.querySelector('[data-action="builder-save"]');
    if (save) save.textContent = 'Save';
  }
});

root.addEventListener('change', (event) => {
  const el = event.target as HTMLSelectElement;
  if (el.dataset.change !== 'builder-template' || !builder || !el.value) return;
  const template = STARTER_DECKS.find((d) => d.id === el.value)!;
  if (builder.cards.length && !window.confirm(`Replace this deck's cards with a copy of ${template.name}?`)) {
    el.value = '';
    return;
  }
  builder.cards = [...template.cards];
  builder.dirty = true;
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && showGuide) {
    showGuide = false;
    render();
    return;
  }
  if (event.key === 'Escape' && selection) {
    selection = null;
    render();
  }
});

render();
