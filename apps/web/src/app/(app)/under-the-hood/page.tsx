'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IconButton, Notch, cardBg } from '@/components/ds';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Timed<T> {
  ms: number;
  ok: boolean;
  value: T | null;
}

interface Stats {
  at: string;
  mysql: Timed<{ messages: number; users: number; conversations: number }>;
  valkey: Timed<{
    appHits: number;
    appMisses: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    produced: number;
    delivered: number;
    persisted: number;
    consumed: Record<string, number>;
    keys: number;
  }>;
  kafka: Timed<{
    topics: { topic: string; partitions: number; messages: number; perSec: number }[];
    lag: { group: string; topic: string; lag: number }[];
  }>;
}

const fmt = new Intl.NumberFormat();

function Card({
  color,
  title,
  ms,
  ok,
  children,
  className,
}: {
  color: keyof typeof cardBg;
  title: string;
  ms?: number;
  ok?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('relative rounded-card p-5 pt-7 text-ink', cardBg[color], className)}>
      <Notch />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title">{title}</h2>
        {ms !== undefined && (
          <span className="rounded-pill bg-ink px-2.5 py-1 text-caption text-white tabular-nums">
            {ok ? `${ms} ms` : 'down'}
          </span>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-title tabular-nums">{value}</p>
      <p className="text-caption text-muted">{label}</p>
    </div>
  );
}

export default function UnderTheHood() {
  const router = useRouter();
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api<Stats>('/stats')
        .then((d) => {
          if (!alive) return;
          setS(d);
          setError(false);
        })
        .catch(() => alive && setError(true));
    void tick();
    const t = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const v = s?.valkey.value;
  const hits = v ? v.appHits + v.keyspaceHits : 0;
  const total = v ? hits + v.appMisses + v.keyspaceMisses : 0;
  const k = s?.kafka.value;

  return (
    <div className="min-h-dvh overflow-y-auto bg-ink px-screen pt-[max(env(safe-area-inset-top),12px)] pb-16 text-white md:h-dvh">
      <div className="flex items-center gap-2 py-2">
        <IconButton label="Back to chats" tone="hub" onClick={() => router.push('/')}>
          <ChevronLeft className="!size-6" />
        </IconButton>
        <span className="text-caption text-white/60">
          {error
            ? 'Reconnecting…'
            : s
              ? `Live · ${new Date(s.at).toLocaleTimeString()}`
              : 'Loading…'}
        </span>
      </div>
      <h1 className="mt-2 text-display md:text-display-desktop">
        Under
        <br />
        the hood
      </h1>
      <p className="mt-2 max-w-md text-body text-white/70">
        Every number below is read live from Pulse’s Aiven services, refreshed every 3 seconds.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-gap sm:grid-cols-2">
        <Card
          color="coral"
          title="Aiven for Apache Kafka"
          ms={s?.kafka.ms}
          ok={s?.kafka.ok}
          className="sm:col-span-2"
        >
          {k ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ul className="flex flex-col gap-1.5">
                {k.topics.map((t) => (
                  <li
                    key={t.topic}
                    className="flex items-baseline justify-between gap-2 rounded-pill bg-ink/10 px-3 py-1.5"
                  >
                    <span className="text-caption font-semibold">{t.topic}</span>
                    <span className="text-caption tabular-nums">
                      {fmt.format(t.messages)} msgs · {t.perSec.toFixed(1)}/s
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col gap-1.5" aria-label="Consumer lag">
                {k.lag.map((l) => (
                  <li
                    key={l.group}
                    className="flex items-baseline justify-between gap-2 rounded-pill bg-ink/10 px-3 py-1.5"
                  >
                    <span className="text-caption font-semibold">pulse-{l.group}</span>
                    <span className="text-caption tabular-nums">lag {fmt.format(l.lag)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="h-24 animate-pulse rounded-bubble bg-ink/10" />
          )}
        </Card>

        <Card color="mustard" title="Aiven for Valkey" ms={s?.valkey.ms} ok={s?.valkey.ok}>
          {v ? (
            <div className="grid grid-cols-2 gap-3">
              <Big
                value={total ? `${Math.round((hits / total) * 100)}%` : '—'}
                label="cache hit rate"
              />
              <Big value={fmt.format(v.keys)} label="keys (presence, unread, sessions…)" />
              <Big value={fmt.format(v.delivered)} label="messages fanned out" />
              <Big value={fmt.format(v.produced)} label="messages produced" />
            </div>
          ) : (
            <div className="h-24 animate-pulse rounded-bubble bg-ink/10" />
          )}
        </Card>

        <Card color="sage" title="Aiven for MySQL" ms={s?.mysql.ms} ok={s?.mysql.ok}>
          {s?.mysql.value ? (
            <div className="grid grid-cols-2 gap-3">
              <Big value={fmt.format(s.mysql.value.messages)} label="messages (source of truth)" />
              <Big value={fmt.format(s.mysql.value.conversations)} label="conversations" />
              <Big value={fmt.format(s.mysql.value.users)} label="people" />
              <Big value={fmt.format(v?.persisted ?? 0)} label="persisted by db-writer" />
            </div>
          ) : (
            <div className="h-24 animate-pulse rounded-bubble bg-ink/10" />
          )}
        </Card>

        <Card color="periwinkle" title="How a message travels" className="sm:col-span-2">
          <Architecture />
        </Card>
      </div>
    </div>
  );
}

/** Send-path diagram; colours come from the token CSS variables so it follows the theme. */
function Architecture() {
  const box = (
    x: number,
    y: number,
    w: number,
    label: string,
    sub: string,
    fill = 'var(--pulse-cream)',
  ) => (
    <g>
      <rect x={x} y={y} width={w} height={52} rx={26} fill={fill} />
      <text
        x={x + w / 2}
        y={y + 23}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="var(--pulse-ink)"
      >
        {label}
      </text>
      <text
        x={x + w / 2}
        y={y + 40}
        textAnchor="middle"
        fontSize="10"
        fill="var(--pulse-ink)"
        opacity="0.75"
      >
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="var(--pulse-ink)"
      strokeWidth="2"
      markerEnd="url(#arrow)"
    />
  );
  return (
    <svg
      viewBox="0 0 720 250"
      role="img"
      aria-label="Client sends over WebSocket to the API, which produces to Kafka; consumers fan out via Valkey, persist to MySQL"
      className="w-full"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--pulse-ink)" />
        </marker>
      </defs>
      {box(10, 20, 120, 'Phone / laptop', 'Socket.IO + ULID')}
      {box(170, 20, 120, 'API', 'zod · membership')}
      {box(330, 20, 150, 'Kafka', 'messages.sent', 'var(--pulse-coral)')}
      {box(530, 20, 170, 'fanout consumer', 'Valkey emitter', 'var(--pulse-mustard)')}
      {box(330, 120, 150, 'db-writer', 'INSERT IGNORE', 'var(--pulse-sage)')}
      {box(530, 120, 170, 'Valkey adapter', 'presence · unread', 'var(--pulse-mustard)')}
      {box(330, 190, 150, 'MySQL', 'source of truth', 'var(--pulse-sage)')}
      {box(170, 120, 120, 'receipts', 'watermarks', 'var(--pulse-butter)')}
      {arrow(130, 46, 168, 46)}
      {arrow(290, 46, 328, 46)}
      {arrow(480, 46, 528, 46)}
      {arrow(405, 72, 405, 118)}
      {arrow(615, 72, 615, 118)}
      {arrow(405, 172, 405, 188)}
      {arrow(530, 146, 70, 74)}
    </svg>
  );
}
