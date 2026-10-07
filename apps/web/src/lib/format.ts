const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const date = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export const formatTime = (iso: string) => time.format(new Date(iso));

/** Chat-list style: time today, weekday this week, else date. */
export function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return time.format(d);
  if (days === 1) return 'Yesterday';
  if (days < 7) return weekday.format(d);
  return date.format(d);
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

export function lastSeen(iso: string | null): string {
  if (!iso) return 'offline';
  return `last seen ${formatWhen(iso).toLowerCase()}${formatWhen(iso).includes(':') ? '' : ` at ${formatTime(iso)}`}`;
}
