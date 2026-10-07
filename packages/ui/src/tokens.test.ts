import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cardColorFor } from './card-color';
import { contrastRatio } from './contrast';
import { renderThemeCss, renderTokensCss } from './css';
import { cardPalette, colors } from './tokens';

const read = (p: string) =>
  readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');

describe('generated CSS', () => {
  it('tokens.css and theme.css are in sync with tokens.ts (run `pnpm tokens`)', () => {
    expect(read('tokens.css')).toBe(renderTokensCss());
    expect(read('theme.css')).toBe(renderThemeCss());
  });
});

describe('WCAG 2.1 AA contrast', () => {
  const surfaces = [
    ...cardPalette.map((c) => [c, colors[c]] as const),
    ['cream', colors.cream],
    ['creamDeep', colors.creamDeep],
  ] as const;

  it.each(surfaces)('ink on %s ≥ 4.5', (_, bg) => {
    expect(contrastRatio(colors.ink, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(surfaces)('muted text on %s ≥ 4.5', (_, bg) => {
    expect(contrastRatio(colors.muted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('cream text on ink (outgoing bubbles) ≥ 4.5', () => {
    expect(contrastRatio(colors.cream, colors.ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('white on ink (hub screens) ≥ 4.5', () => {
    expect(contrastRatio(colors.white, colors.ink)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('cardColorFor', () => {
  it('is stable and always within the palette', () => {
    expect(cardColorFor('conv_123')).toBe(cardColorFor('conv_123'));
    for (let i = 0; i < 200; i++) expect(cardPalette).toContain(cardColorFor(`c${i}`));
  });

  it('spreads conversations across every palette colour', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => cardColorFor(`01J${i}`)));
    expect(seen.size).toBe(cardPalette.length);
  });
});
