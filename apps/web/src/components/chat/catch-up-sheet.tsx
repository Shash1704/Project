'use client';

import { AtSign, CalendarClock, CheckCircle2, Gavel } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RowPill, Sheet } from '@/components/ds';
import { api, ApiError } from '@/lib/api';

export interface CatchUp {
  summary: string[];
  decisions: { text: string; messageId: string }[];
  deadlines: { text: string; when: string; messageId: string }[];
  mentions: { who: string; text: string; messageId: string }[];
  actionItems: { text: string; messageId: string }[];
  messageCount: number;
  cached: boolean;
}

/** Render **bold** markers from the model as <b>, everything else as plain text (no HTML injection). */
function Bolded({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/(\*\*[^*]+\*\*)/g)
        .map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <b key={i}>{part.slice(2, -2)}</b>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
    </>
  );
}

export function CatchUpSheet({
  conversationId,
  open,
  onClose,
  onJump,
}: {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onJump: (messageId: string) => void;
}) {
  const [data, setData] = useState<CatchUp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    api<CatchUp>(`/ai/conversations/${conversationId}/catch-up`, { method: 'POST' })
      .then((d) => alive && setData(d))
      .catch(
        (e) =>
          alive && setError(e instanceof ApiError ? e.message : 'Could not summarise right now'),
      );
    return () => {
      alive = false;
    };
  }, [open, conversationId]);

  const jump = (id: string) => {
    onClose();
    onJump(id);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="While you were away"
      eyebrow={
        <p className="mb-1 flex items-center gap-2 text-caption text-muted">
          <span aria-hidden className="size-2 rounded-pill bg-highlight" />
          AI summary
          {data
            ? ` · last ${data.messageCount} messages${data.cached ? ' · cached in Valkey' : ''}`
            : ''}
        </p>
      }
    >
      {error ? (
        <p role="alert" className="rounded-card bg-coral p-4 text-body">
          {error}
        </p>
      ) : !data ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Summarising">
          {[90, 75, 85, 60].map((w, i) => (
            <div
              key={i}
              className="h-4 animate-pulse rounded-pill bg-cream-deep"
              style={{ width: `${w}%` }}
            />
          ))}
          <div className="mt-4 h-12 animate-pulse rounded-pill bg-cream-deep" />
          <div className="h-12 animate-pulse rounded-pill bg-cream-deep" />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 text-body">
            {data.summary.map((line, i) => (
              <li key={i}>
                <Bolded text={line} />
              </li>
            ))}
          </ul>
          <Section
            title="Decisions"
            items={data.decisions.map((d) => ({ id: d.messageId, text: d.text, icon: <Gavel /> }))}
            onJump={jump}
          />
          <Section
            title="Deadlines"
            items={data.deadlines.map((d) => ({
              id: d.messageId,
              text: `${d.text} · ${d.when}`,
              icon: <CalendarClock />,
            }))}
            onJump={jump}
          />
          <Section
            title="Mentions"
            items={data.mentions.map((d) => ({
              id: d.messageId,
              text: `@${d.who} · ${d.text}`,
              icon: <AtSign />,
            }))}
            onJump={jump}
          />
          <Section
            title="To-dos"
            items={data.actionItems.map((d) => ({
              id: d.messageId,
              text: d.text,
              icon: <CheckCircle2 />,
            }))}
            onJump={jump}
          />
        </>
      )}
    </Sheet>
  );
}

function Section({
  title,
  items,
  onJump,
}: {
  title: string;
  items: { id: string; text: string; icon: React.ReactNode }[];
  onJump: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <>
      <h3 className="mt-6 mb-2 text-card-title">{title}</h3>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <RowPill key={`${it.id}-${i}`} icon={it.icon} onClick={() => onJump(it.id)}>
            {it.text}
          </RowPill>
        ))}
      </div>
    </>
  );
}
