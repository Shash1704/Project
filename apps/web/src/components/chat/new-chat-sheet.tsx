'use client';

import type { ConversationDto, UserDto } from '@pulse/shared';
import { Check, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Sheet } from '@/components/ds';
import { api, ApiError } from '@/lib/api';
import { upsertConversation } from '@/lib/store';
import { cn } from '@/lib/utils';

export function NewChatSheet({ mode, onClose }: { mode: null | 'direct' | 'group'; onClose: () => void }) {
  return (
    <Sheet open={!!mode} onClose={onClose} title={mode === 'group' ? 'New group' : 'New chat'}>
      {mode && <NewChatBody key={mode} mode={mode} onClose={onClose} />}
    </Sheet>
  );
}

function NewChatBody({ mode, onClose }: { mode: 'direct' | 'group'; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<UserDto[] | null>(null);
  const [picked, setPicked] = useState<UserDto[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<UserDto[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const open = (c: ConversationDto) => {
    upsertConversation(c);
    onClose();
    router.push(`/c/${c.id}`);
  };

  const startDirect = async (u: UserDto) => {
    setBusy(true);
    try {
      open(await api<ConversationDto>('/conversations/direct', { method: 'POST', json: { userId: u.id } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the chat');
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    setBusy(true);
    try {
      open(
        await api<ConversationDto>('/conversations/group', {
          method: 'POST',
          json: { title: title.trim(), memberIds: picked.map((p) => p.id) },
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the group');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (u: UserDto) =>
    setPicked((p) => (p.some((x) => x.id === u.id) ? p.filter((x) => x.id !== u.id) : [...p, u]));

  return (
    <>
      {mode === 'group' && (
        <label className="mb-3 block">
          <span className="mb-1 block text-caption text-muted">Group name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Weekend plans"
            className="min-h-12 w-full rounded-pill bg-cream-deep px-5 text-body outline-none placeholder:text-muted"
          />
        </label>
      )}
      <label className="flex min-h-12 items-center gap-2 rounded-pill bg-cream-deep px-5">
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Search people</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          className="min-h-12 flex-1 bg-transparent text-body outline-none placeholder:text-muted"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-pill bg-coral px-4 py-2 text-body">
          {error}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {results === null &&
          Array.from({ length: 4 }, (_, i) => <li key={i} className="h-14 animate-pulse rounded-pill bg-cream-deep" aria-hidden />)}
        {results?.length === 0 && <li className="px-2 text-body text-muted">No one matches “{q}”.</li>}
        {results?.map((u) => {
          const selected = picked.some((p) => p.id === u.id);
          return (
            <li key={u.id}>
              <button
                type="button"
                disabled={busy}
                aria-pressed={mode === 'group' ? selected : undefined}
                onClick={() => (mode === 'group' ? toggle(u) : void startDirect(u))}
                className="flex min-h-14 w-full items-center gap-3 rounded-pill bg-cream-deep py-1.5 pr-4 pl-1.5 text-left transition-transform active:scale-[0.98]"
              >
                <Avatar seed={u.avatarSeed} src={u.avatarUrl} name="" size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-card-title">{u.name}</span>
                  {u.about && <span className="block truncate text-caption text-muted">{u.about}</span>}
                </span>
                {mode === 'group' && (
                  <span
                    aria-hidden
                    className={cn('flex size-6 items-center justify-center rounded-pill border-2 border-ink', selected && 'bg-ink text-white')}
                  >
                    {selected && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {mode === 'group' && (
        <button
          type="button"
          disabled={busy || !title.trim() || picked.length === 0}
          onClick={() => void createGroup()}
          className="sticky bottom-0 mt-4 min-h-14 w-full rounded-pill bg-ink text-card-title text-cream disabled:opacity-40"
        >
          {picked.length ? `Create with ${picked.length} ${picked.length === 1 ? 'person' : 'people'}` : 'Pick at least one person'}
        </button>
      )}
    </>
  );
}
