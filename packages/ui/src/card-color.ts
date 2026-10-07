import { cardPalette, type CardColor } from './tokens';

/** FNV-1a — stable across runtimes, so a conversation keeps its colour on every device. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function cardColorFor(conversationId: string): CardColor {
  return cardPalette[hash(conversationId) % cardPalette.length]!;
}
