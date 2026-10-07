/**
 * Pulse design tokens — the only place colours, radii, spacing, type and motion are defined.
 * tokens.css / theme.css are generated from this file (`pnpm tokens`); never edit them by hand.
 */

export const colors = {
  ink: '#0B0B0B',
  inkRaised: '#1E1E1E',
  cream: '#F8EFC8',
  creamDeep: '#EFE3B5',
  taupeGlass: 'rgba(120, 110, 90, 0.25)',
  coral: '#E9775A',
  mustard: '#F3CB48',
  sage: '#A9D68C',
  periwinkle: '#9EB6EC',
  butter: '#F7EDC2',
  highlight: '#F6D34A',
  // Spec suggests 0.55; 0.74 (0.73 + margin) keeps caption text AA on every card colour (coral is the limit).
  muted: 'rgba(11, 11, 11, 0.74)',
  white: '#FFFFFF',
} as const;

/** Conversation card colours, assigned per conversation by a stable hash of its ID. */
export const cardPalette = ['coral', 'mustard', 'sage', 'periwinkle', 'butter'] as const;
export type CardColor = (typeof cardPalette)[number];

/** Mustard/highlight are reserved for AI surfaces so AI output is always recognisable. */
export const aiAccent = colors.highlight;

export const radii = {
  card: 32,
  pill: 999,
  bubble: 24,
  sheet: 36,
} as const;

export const spacing = {
  unit: 4,
  screen: 20,
  gap: 10,
} as const;

export const sizes = {
  iconButton: 48,
  iconButtonSm: 44,
  iconButtonLg: 56,
  fab: 64,
  fabRing: 4,
  desktopListWidth: 380,
} as const;

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: number;
  tracking: string;
}

export const type = {
  display: { size: 48, lineHeight: 1.05, weight: 600, tracking: '-0.02em' },
  displayDesktop: { size: 40, lineHeight: 1.05, weight: 600, tracking: '-0.02em' },
  title: { size: 28, lineHeight: 1.1, weight: 600, tracking: '-0.01em' },
  cardTitle: { size: 15, lineHeight: 1.25, weight: 600, tracking: '0em' },
  body: { size: 15, lineHeight: 1.5, weight: 400, tracking: '0em' },
  caption: { size: 12, lineHeight: 1.3, weight: 400, tracking: '0em' },
} as const satisfies Record<string, TypeStyle>;

export const fonts = {
  sans: '"Lexend", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
} as const;

/** Framer Motion springs. Components must fall back to instant transitions under prefers-reduced-motion. */
export const motion = {
  spring: { type: 'spring', stiffness: 400, damping: 32 },
  springBouncy: { type: 'spring', stiffness: 500, damping: 22 },
  pressScale: 0.97,
  messageEnterMs: 150,
} as const;

export const tokens = { colors, cardPalette, radii, spacing, sizes, type, fonts, motion } as const;
export type Tokens = typeof tokens;
