import type { CardColor } from '@pulse/ui/tokens';

/** Static class maps so Tailwind can see every colour utility at build time. */
export const cardBg: Record<CardColor, string> = {
  coral: 'bg-coral',
  mustard: 'bg-mustard',
  sage: 'bg-sage',
  periwinkle: 'bg-periwinkle',
  butter: 'bg-butter',
};
