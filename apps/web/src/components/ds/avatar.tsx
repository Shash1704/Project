'use client';

import { createAvatar } from '@dicebear/core';
import * as notionists from '@dicebear/notionists';
import { useMemo } from 'react';
import { colors } from '@pulse/ui/tokens';
import { cn } from '@/lib/utils';

const bg = [colors.coral, colors.mustard, colors.sage, colors.periwinkle, colors.butter].map((c) =>
  c.replace('#', '').toLowerCase(),
);

/** DiceBear "Notionists" (CC0) — a friendly illustrated style, generated locally from a seed. */
export function avatarUri(seed: string): string {
  return createAvatar(notionists, {
    seed,
    backgroundColor: bg,
    backgroundType: ['solid'],
  }).toDataUri();
}

export interface AvatarProps {
  seed: string;
  name: string;
  size?: number;
  src?: string | null;
  className?: string;
  online?: boolean;
}

export function Avatar({ seed, name, size = 40, src, className, online }: AvatarProps) {
  const uri = useMemo(() => src ?? avatarUri(seed), [seed, src]);
  return (
    <span
      className={cn('relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URI, nothing to optimise */}
      <img
        src={uri}
        alt={name}
        width={size}
        height={size}
        className="size-full rounded-pill bg-cream-deep object-cover ring-[3px] ring-cream"
      />
      {online && (
        <span
          role="status"
          aria-label={`${name} is online`}
          className="absolute right-0 bottom-0 size-3 rounded-pill bg-sage ring-2 ring-cream"
        />
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 40,
  max = 4,
}: {
  people: { seed: string; name: string; src?: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center" aria-label={`${people.length} members`}>
      {shown.map((p, i) => (
        <Avatar key={p.seed} {...p} size={size} className={cn(i > 0 && '-ml-3')} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-3 inline-flex items-center justify-center rounded-pill bg-cream-deep text-caption font-semibold text-ink ring-[3px] ring-cream"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
