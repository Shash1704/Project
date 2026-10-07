'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Segmented stepper: the selected value is large and bright, neighbours small and dim.
 * Arrow keys move the selection (role="slider" semantics for screen readers).
 */
export function Stepper<T extends string>({
  label,
  options,
  value,
  onChange,
  format = (v) => v,
  formatShort,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  /** Compact label for the dim neighbours (defaults to `format`). */
  formatShort?: (v: T) => string;
}) {
  const idx = Math.max(0, options.indexOf(value));
  const move = (d: number) => {
    const next = options[Math.min(options.length - 1, Math.max(0, idx + d))];
    if (next !== undefined) onChange(next);
  };
  const visible = [idx - 1, idx, idx + 1];

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={options.length - 1}
      aria-valuenow={idx}
      aria-valuetext={format(value)}
      onKeyDown={(e) => {
        const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (d) {
          e.preventDefault();
          move(d);
        }
      }}
      className="flex h-icon-button min-w-0 flex-1 items-center justify-center gap-2.5 overflow-hidden rounded-pill bg-ink-raised px-3"
    >
      {visible.map((i) => {
        const opt = options[i];
        if (opt === undefined) return <span key={`gap${i}`} className="w-6" aria-hidden />;
        const selected = i === idx;
        return (
          <motion.button
            key={opt}
            layout
            type="button"
            tabIndex={-1}
            aria-hidden={!selected}
            onClick={() => onChange(opt)}
            className={cn(
              'min-h-11 shrink-0 font-semibold whitespace-nowrap transition-colors',
              selected ? 'text-title text-white' : 'text-caption text-white/45',
            )}
          >
            {selected ? format(opt) : (formatShort ?? format)(opt)}
          </motion.button>
        );
      })}
    </div>
  );
}
