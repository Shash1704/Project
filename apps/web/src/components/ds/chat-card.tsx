'use client';

import { motion } from 'framer-motion';
import { BellOff, Mic, Pin } from 'lucide-react';
import Image from 'next/image';
import { motion as m, type CardColor } from '@pulse/ui/tokens';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { cardBg } from './card-colors';
import { Notch } from './notch';
import { RoundCheckbox } from './round-checkbox';

interface Base {
  id: string;
  name: string;
  color: CardColor;
  unread: number;
  muted?: boolean;
  onOpen?: () => void;
  /** Shared-element id so the card can morph into the conversation screen. */
  layoutId?: string;
}

export type ChatCardProps =
  | (Base & {
      variant: 'group';
      items: { id: string; text: string; done: boolean }[];
      page?: number;
      pages?: number;
    })
  | (Base & { variant: 'media'; imageUrl: string; imageAlt: string })
  | (Base & {
      variant: 'pinned';
      avatarSeed: string;
      avatarSrc?: string | null;
      onTogglePin?: () => void;
    })
  | (Base & { variant: 'voice'; caption: string; onPlay?: () => void })
  | (Base & { variant: 'text'; preview: string; time?: string });

function CornerBadge({ unread, muted, dark }: { unread: number; muted?: boolean; dark?: boolean }) {
  if (muted) {
    return (
      <span
        role="img"
        aria-label="Muted"
        className={cn(
          'absolute top-3 right-3 flex size-8 items-center justify-center rounded-pill',
          dark ? 'bg-ink text-white' : 'bg-ink/10 text-ink',
        )}
      >
        <BellOff className="size-4" />
      </span>
    );
  }
  if (!unread) return null;
  return (
    <span
      aria-label={`${unread} unread`}
      className="absolute top-3 right-3 flex h-8 min-w-8 items-center justify-center rounded-pill bg-ink px-2 text-caption font-semibold text-white tabular-nums"
    >
      {unread > 99 ? '99+' : unread}
    </span>
  );
}

const spanClass = {
  group: 'aspect-square',
  media: 'row-span-2 min-h-full',
  pinned: 'col-span-2',
  voice: 'aspect-square',
  text: 'aspect-square',
} as const;

export function ChatCard(props: ChatCardProps) {
  const { name, color, unread, muted, onOpen, layoutId, variant } = props;
  const isPinned = variant === 'pinned';

  return (
    <motion.div
      layoutId={layoutId}
      role="button"
      tabIndex={0}
      aria-label={`Open ${name}${unread ? `, ${unread} unread` : ''}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      whileTap={{ scale: m.pressScale }}
      transition={m.spring}
      className={cn(
        'relative cursor-pointer overflow-hidden text-ink outline-offset-4',
        isPinned ? 'rounded-pill bg-cream' : cn('rounded-card', cardBg[color]),
        spanClass[variant],
      )}
    >
      {variant === 'media' ? (
        <>
          <Image
            src={props.imageUrl}
            alt={props.imageAlt}
            fill
            sizes="(min-width: 768px) 190px, 50vw"
            className="object-cover"
          />
          <span className="absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-bubble bg-cream px-3 py-1.5 text-card-title line-clamp-2">
            {name}
          </span>
          <CornerBadge unread={unread} muted={muted} dark />
        </>
      ) : isPinned ? (
        <div className="flex min-h-[72px] items-center gap-3 py-2.5 pr-2.5 pl-2.5">
          <Avatar seed={props.avatarSeed} src={props.avatarSrc} name="" size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted">{unread ? `${unread} new` : 'Pinned'}</p>
            <p className="truncate text-card-title">{name}</p>
          </div>
          <span
            role="img"
            aria-label="Pinned"
            className="flex size-icon-button items-center justify-center rounded-pill bg-ink text-white"
          >
            <Pin className="size-5" />
          </span>
        </div>
      ) : (
        <div className="flex h-full flex-col p-4 pt-6">
          <Notch />
          <CornerBadge unread={unread} muted={muted} />
          <p
            className={cn(
              'pr-10 text-card-title',
              variant === 'group' ? 'line-clamp-1' : 'line-clamp-2',
            )}
          >
            {name}
          </p>

          {variant === 'group' && (
            <>
              <div className="flex flex-1 flex-col justify-end">
                {props.items.slice(0, 2).map((it) => (
                  <RoundCheckbox key={it.id} checked={it.done}>
                    {it.text}
                  </RoundCheckbox>
                ))}
              </div>
              {(props.pages ?? 1) > 1 && (
                <span aria-hidden className="mt-1 flex justify-center gap-1.5">
                  {Array.from({ length: props.pages ?? 1 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        'size-1.5 rounded-pill',
                        i === (props.page ?? 0) ? 'bg-ink' : 'bg-ink/25',
                      )}
                    />
                  ))}
                </span>
              )}
            </>
          )}

          {variant === 'text' && (
            <>
              <p className="mt-auto text-caption text-muted line-clamp-3">{props.preview}</p>
              {props.time && <p className="mt-1 text-caption text-muted">{props.time}</p>}
            </>
          )}

          {variant === 'voice' && (
            <>
              <p className="mt-1 text-caption text-muted">{props.caption}</p>
              <span aria-hidden className="mt-auto mb-1 flex h-6 items-end gap-[3px]">
                {[8, 14, 20, 12, 22, 16, 9, 18, 13, 7, 15].map((h, i) => (
                  <span key={i} className="w-[3px] rounded-pill bg-ink/60" style={{ height: h }} />
                ))}
              </span>
            </>
          )}
        </div>
      )}

      {variant === 'voice' && (
        <motion.button
          type="button"
          aria-label={`Play voice note in ${name}`}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            props.onPlay?.();
          }}
          className="absolute right-3 bottom-3 flex size-icon-button-lg items-center justify-center rounded-pill bg-ink text-white"
        >
          <Mic className="size-6" />
        </motion.button>
      )}
    </motion.div>
  );
}
