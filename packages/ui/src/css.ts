import { tokens, type TypeStyle } from './tokens';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const HEADER = '/* Generated from src/tokens.ts by `pnpm tokens`. Do not edit. */\n';

/** Plain CSS custom properties — usable anywhere. */
export function renderTokensCss(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(tokens.colors)) lines.push(`--pulse-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(tokens.radii))
    lines.push(`--pulse-radius-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(tokens.spacing))
    lines.push(`--pulse-space-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(tokens.sizes))
    lines.push(`--pulse-size-${kebab(k)}: ${v}px;`);
  for (const [k, v] of Object.entries(tokens.type) as [string, TypeStyle][]) {
    const n = kebab(k);
    lines.push(
      `--pulse-text-${n}: ${v.size}px;`,
      `--pulse-text-${n}-lh: ${v.lineHeight};`,
      `--pulse-text-${n}-weight: ${v.weight};`,
      `--pulse-text-${n}-tracking: ${v.tracking};`,
    );
  }
  lines.push(`--pulse-font-sans: var(--font-lexend, ${tokens.fonts.sans});`);
  return `${HEADER}:root {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`;
}

/** Tailwind v4 theme mapping onto the CSS variables, e.g. `bg-coral`, `rounded-card`, `text-display`. */
export function renderThemeCss(): string {
  const lines: string[] = ['--color-*: initial;'];
  for (const k of Object.keys(tokens.colors))
    lines.push(`--color-${kebab(k)}: var(--pulse-${kebab(k)});`);
  for (const k of Object.keys(tokens.radii))
    lines.push(`--radius-${kebab(k)}: var(--pulse-radius-${kebab(k)});`);
  lines.push(
    '--spacing-screen: var(--pulse-space-screen);',
    '--spacing-gap: var(--pulse-space-gap);',
  );
  for (const k of Object.keys(tokens.sizes))
    lines.push(`--spacing-${kebab(k)}: var(--pulse-size-${kebab(k)});`);
  for (const k of Object.keys(tokens.type)) {
    const n = kebab(k);
    lines.push(
      `--text-${n}: var(--pulse-text-${n});`,
      `--text-${n}--line-height: var(--pulse-text-${n}-lh);`,
      `--text-${n}--font-weight: var(--pulse-text-${n}-weight);`,
      `--text-${n}--letter-spacing: var(--pulse-text-${n}-tracking);`,
    );
  }
  lines.push('--font-sans: var(--pulse-font-sans);');
  return `${HEADER}@theme inline {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`;
}
