import { CARDS } from './engine/cards';
import { mainTypes, type DeckDef } from './engine/decks';

/** A deck made in the deck builder, saved in this browser. */
export interface CustomDeck {
  id: string;
  name: string;
  cards: string[];
}

const KEY = 'card-battler.decks.v1';

export function loadCustomDecks(): CustomDeck[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d): d is CustomDeck => typeof d?.id === 'string' && typeof d?.name === 'string' && Array.isArray(d?.cards))
      .map((d) => ({ ...d, cards: d.cards.filter((id) => id in CARDS) })); // Drop cards that no longer exist.
  } catch {
    return [];
  }
}

export function saveCustomDecks(decks: CustomDeck[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); decks then last for this visit only.
  }
}

export function toDeckDef(deck: CustomDeck): DeckDef {
  return { id: deck.id, name: deck.name, types: mainTypes(deck.cards), description: 'Your custom deck.', cards: deck.cards };
}
