'use client';

import { LANGS, type Lang } from '@pulse/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, IconButton, Notch, Stepper } from '@/components/ds';
import { acceptAuth, api, ApiError, refresh, type AuthResult } from '@/lib/api';
import { cn } from '@/lib/utils';

const LANG_LABEL: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ', ta: 'தமிழ்' };
const LANG_SHORT: Record<Lang, string> = { en: 'EN', hi: 'HI', kn: 'KN', ta: 'TA' };

const slides = [
  {
    title: ['Chats that', 'keep up'],
    body: 'Real-time messaging with ticks, typing and presence — every message rides Kafka on Aiven.',
    color: 'bg-coral',
  },
  {
    title: ['Catch me', 'up'],
    body: 'Back to 200 unread? Get the summary, decisions and deadlines in one tap.',
    color: 'bg-mustard',
  },
  {
    title: ['Ask your', 'chats'],
    body: '“When is the demo?” — semantic search across every chat you’re in, in your language.',
    color: 'bg-periwinkle',
  },
];

interface DemoAccount {
  id: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
}

export function Welcome() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [lang, setLang] = useState<Lang>('en');
  const [demo, setDemo] = useState<DemoAccount[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [emailLogin, setEmailLogin] = useState(false);
  const [step, setStep] = useState<'pick' | 'email' | 'code'>('pick');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pulse:lang') as Lang | null;
      // Read after hydration so the prerendered HTML (English) matches the first client render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && LANGS.includes(saved)) setLang(saved);
    } catch {
      /* storage unavailable */
    }
    void refresh().then((r) => r && router.replace('/'));
    api<DemoAccount[]>('/auth/demo-accounts')
      .then(setDemo)
      .catch(() => {
        setOffline(true);
        setDemo([]);
      });
    api<{ emailLogin: boolean }>('/auth/config')
      .then((c) => setEmailLogin(c.emailLogin))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);

  const pickLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem('pulse:lang', l);
    } catch {
      /* storage unavailable */
    }
  };

  const finish = async (r: AuthResult) => {
    acceptAuth(r);
    if (r.user.lang !== lang)
      await api('/users/me', { method: 'PATCH', json: { lang } }).catch(() => {});
    router.replace('/');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const s = slides[slide]!;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col bg-ink px-screen pt-8 pb-10 text-white">
      <div className="flex items-center justify-between">
        <span className="text-title">Pulse</span>
        <div className="w-56">
          <Stepper
            label="Language"
            options={LANGS}
            value={lang}
            onChange={pickLang}
            format={(l) => LANG_LABEL[l]}
            formatShort={(l) => LANG_SHORT[l]}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={slide}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className={cn('relative mt-8 rounded-card p-6 pt-9 text-ink', s.color)}
          aria-roledescription="slide"
          aria-label={`${slide + 1} of ${slides.length}`}
        >
          <Notch />
          <h1 className="text-display">
            {s.title[0]}
            <br />
            {s.title[1]}
          </h1>
          <p className="mt-4 max-w-sm text-body">{s.body}</p>
        </motion.section>
      </AnimatePresence>
      <div className="mt-4 flex justify-center gap-1" role="tablist" aria-label="Slides">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === slide}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setSlide(i)}
            className="flex size-11 items-center justify-center"
          >
            <span
              className={cn(
                'h-2 rounded-pill transition-all',
                i === slide ? 'w-6 bg-white' : 'w-2 bg-white/30',
              )}
            />
          </button>
        ))}
      </div>

      <section aria-label="Sign in" className="mt-6">
        {error && (
          <p role="alert" className="mb-3 rounded-pill bg-coral px-4 py-2 text-body text-ink">
            {error}
          </p>
        )}

        {step === 'pick' && (
          <>
            <h2 className="mb-3 text-card-title text-white/80">Try as judge</h2>
            <div className="flex flex-col gap-2">
              {demo === null &&
                [0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-pill bg-ink-raised"
                    aria-hidden
                  />
                ))}
              {demo?.length === 0 && (
                <p className="rounded-card bg-ink-raised p-4 text-body text-white/70">
                  {offline ? (
                    'Can’t reach the Pulse server right now. Try again in a moment.'
                  ) : (
                    <>
                      Demo accounts aren’t seeded yet. Run <code>pnpm seed</code>.
                    </>
                  )}
                </p>
              )}
              {demo?.map((d) => (
                <motion.button
                  key={d.id}
                  type="button"
                  disabled={busy}
                  whileTap={{ scale: 0.97 }}
                  onClick={() =>
                    void run(async () =>
                      finish(
                        await api<AuthResult>('/auth/demo', {
                          method: 'POST',
                          json: { userId: d.id },
                        }),
                      ),
                    )
                  }
                  className="flex min-h-16 items-center gap-3 rounded-pill bg-cream py-2 pr-2 pl-2 text-left text-ink disabled:opacity-60"
                >
                  <Avatar seed={d.avatarSeed} src={d.avatarUrl} name="" size={48} />
                  <span className="flex-1 text-card-title">{d.name}</span>
                  <span className="flex size-icon-button items-center justify-center rounded-pill bg-ink text-white">
                    <ArrowRight className="size-5" />
                  </span>
                </motion.button>
              ))}
            </div>
            {emailLogin && (
              <button
                type="button"
                onClick={() => setStep('email')}
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-pill border-2 border-white/25 text-body"
              >
                <Mail className="size-4" /> Sign in with email
              </button>
            )}
          </>
        )}

        {step === 'email' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/auth/otp/request', { method: 'POST', json: { email } });
                setStep('code');
              });
            }}
            className="flex flex-col gap-3"
          >
            <label className="text-card-title text-white/80" htmlFor="email">
              Your email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-14 rounded-pill bg-cream px-5 text-body text-ink outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="min-h-12 flex-1 rounded-pill border-2 border-white/25"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-12 flex-[2] rounded-pill bg-cream font-semibold text-ink"
              >
                Send code
              </button>
            </div>
          </form>
        )}

        {step === 'code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () =>
                finish(
                  await api<AuthResult>('/auth/otp/verify', {
                    method: 'POST',
                    json: { email, code },
                  }),
                ),
              );
            }}
            className="flex flex-col gap-3"
          >
            <label className="text-card-title text-white/80" htmlFor="code">
              Enter the 6-digit code sent to {email}
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="min-h-14 rounded-pill bg-cream px-5 text-center text-title tracking-[0.4em] text-ink outline-none"
            />
            <div className="flex gap-2">
              <IconButton label="Back" tone="hub" onClick={() => setStep('email')}>
                <ArrowRight className="rotate-180" />
              </IconButton>
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="min-h-12 flex-1 rounded-pill bg-cream font-semibold text-ink disabled:opacity-50"
              >
                Verify & continue
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
