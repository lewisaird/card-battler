import { getCard } from '../engine/cards';
import type { GameEvent, LaneIndex, PlayerId, Row, Target } from '../engine/types';
import { cardFace, esc } from './render';

/** How long after an attack lunge its hits land. */
const HIT_DELAY_MS = 160;
/** How long a revealed spell, relic or trap is shown before its effect lands. */
const REVEAL_HIT_DELAY_MS = 550;
/**
 * Effects normally clean up when their animation ends, but browsers pause animations in hidden
 * tabs, so this fallback stops them piling up.
 */
const CLEANUP_MS = 2000;

function onDone(el: HTMLElement, done: () => void) {
  const timer = window.setTimeout(done, CLEANUP_MS);
  el.addEventListener(
    'animationend',
    () => {
      clearTimeout(timer);
      done();
    },
    { once: true },
  );
}

function cell(player: PlayerId, lane: LaneIndex, row: Row | 'crystal'): HTMLElement | null {
  return document.querySelector(`[data-action="cell"][data-player="${player}"][data-lane="${lane}"][data-row="${row}"]`);
}

/** Restart a CSS animation class on an element. */
function pulse(el: HTMLElement | null, className: string) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth; // Force a reflow so the animation plays again.
  el.classList.add(className);
  onDone(el, () => el.classList.remove(className));
}

/**
 * Floating text lives in a layer outside the app root, so it survives the board being redrawn.
 */
function fxLayer(): HTMLElement {
  let layer = document.getElementById('fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

function float(el: HTMLElement | null, text: string, kind: string) {
  if (!el) return;
  const layer = fxLayer();
  const rect = el.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = `fx-float ${kind}`;
  fx.textContent = text;
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;
  layer.appendChild(fx);
  onDone(fx, () => fx.remove());
}

function targetCell(t: Target): HTMLElement | null {
  return t.kind === 'creature' ? cell(t.player, t.lane, t.row) : cell(t.player, t.lane, 'crystal');
}

/** Show a spell, relic or trap card large over the board for a moment. */
function reveal(e: Extract<GameEvent, { type: 'reveal' }>, me: PlayerId, names: string[]) {
  const board = document.querySelector('.board-area');
  if (!board) return;
  const card = getCard(e.cardId);
  const mine = e.player === me;
  const hidden = card.kind === 'trap' && !mine;
  const verb = card.kind === 'spell' ? 'cast' : card.kind === 'relic' ? 'play' : 'set';
  const caption = hidden
    ? `${esc(names[e.player])} sets a face-down trap`
    : `${mine ? 'You' : esc(names[e.player])} ${mine ? verb : `${verb}s`} <b>${esc(card.name)}</b>`;
  const face = hidden ? '<div class="card hand-card card-back"><span>🪤</span>Face-down trap</div>' : cardFace(card, [], '');

  const layer = fxLayer();
  const rect = board.getBoundingClientRect();
  const fx = document.createElement('div');
  fx.className = 'fx-reveal';
  fx.innerHTML = `<div class="reveal-caption">${caption}</div>${face}`;
  fx.style.left = `${rect.left + rect.width / 2}px`;
  fx.style.top = `${rect.top + rect.height / 2}px`;
  layer.appendChild(fx);
  onDone(fx, () => fx.remove());

  if (e.target) {
    const target = e.target;
    window.setTimeout(() => pulse(targetCell(target), 'spell-target'), REVEAL_HIT_DELAY_MS);
  }
}

function play(e: GameEvent, me: PlayerId, names: string[]) {
  switch (e.type) {
    case 'reveal':
      reveal(e, me, names);
      break;
    case 'attack':
      pulse(cell(e.player, e.lane, e.row), e.player === me ? 'lunge-up' : 'lunge-down');
      break;
    case 'damage': {
      const el = cell(e.player, e.lane, e.target);
      pulse(el, 'hit');
      float(el, `-${e.amount}`, e.target === 'crystal' ? 'crystal-dmg' : 'dmg');
      break;
    }
    case 'blocked':
      float(cell(e.player, e.lane, e.row), '🛡️ Blocked', 'info');
      break;
    case 'death':
      float(cell(e.player, e.lane, e.row), '💀', 'death');
      break;
    case 'play':
      pulse(cell(e.player, e.lane, e.row), 'enter');
      break;
    case 'evolve':
      pulse(cell(e.player, e.lane, e.row), 'evolve-flash');
      float(cell(e.player, e.lane, e.row), '⬆ Evolved!', 'evolve');
      break;
    case 'trap':
      float(cell(e.player, e.lane, 'crystal'), `🪤 ${getCard(e.cardId).name}!`, 'trap');
      break;
    case 'crystalDestroyed':
      pulse(cell(e.player, e.lane, 'crystal'), 'shatter');
      float(cell(e.player, e.lane, 'crystal'), '💥', 'big');
      break;
  }
}

/**
 * Animate a batch of events from one action. Hits land just after an attack lunge, or after a
 * revealed card has been on screen for a moment. Returns true if a card was revealed.
 */
export function playEffects(events: GameEvent[], me: PlayerId, names: string[]): boolean {
  let delay = 0;
  let revealed = false;
  for (const e of events) {
    if (e.type === 'attack' || e.type === 'reveal') {
      play(e, me, names);
      delay = e.type === 'attack' ? HIT_DELAY_MS : REVEAL_HIT_DELAY_MS;
      revealed ||= e.type === 'reveal';
    } else if (delay) {
      window.setTimeout(() => play(e, me, names), delay);
    } else {
      play(e, me, names);
    }
  }
  return revealed;
}
