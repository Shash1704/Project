'use client';

import { CalendarClock, Gavel, Menu, MoreHorizontal, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { cardPalette, colors, type } from '@pulse/ui/tokens';
import {
  AiChip,
  AiTray,
  AvatarStack,
  Bubble,
  ChatCard,
  Composer,
  ConversationTitle,
  ConversationTopBar,
  Fab,
  FilterPill,
  IconButton,
  MessageMenu,
  RowPill,
  Sheet,
  Stepper,
  SuggestionPill,
  TypingIndicator,
  cardBg,
  type ComposerTool,
} from '@/components/ds';

const people = [
  { seed: 'aarav', name: 'Aarav' },
  { seed: 'meera', name: 'Meera' },
  { seed: 'kiran', name: 'Kiran' },
  { seed: 'zoya', name: 'Zoya' },
  { seed: 'dev', name: 'Dev' },
];

const LANGS = ['English', 'हिन्दी', 'ಕನ್ನಡ', 'தமிழ்'] as const;
const LANG_SHORT: Record<(typeof LANGS)[number], string> = {
  English: 'EN',
  हिन्दी: 'HI',
  ಕನ್ನಡ: 'KN',
  தமிழ்: 'TA',
};

/**
 * Every token, card variant, button, bubble, pill, the context menu, AI tray and Catch Me Up sheet,
 * rendered with the real design-system components. Sample copy only — no app data.
 */
export function DesignPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState('All');
  const [fabOpen, setFabOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [tool, setTool] = useState<ComposerTool | null>('replies');
  const [aiOn, setAiOn] = useState(true);
  const [lang, setLang] = useState<(typeof LANGS)[number]>('हिन्दी');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState([
    { id: 'a', text: 'Book the venue by Friday', done: true },
    { id: 'b', text: 'Meera to share the deck', done: false },
    { id: 'c', text: 'Vote on the team name', done: false },
  ]);

  return (
    <div className="min-h-dvh bg-ink md:grid md:grid-cols-[var(--pulse-size-desktop-list-width)_1fr]">
      {/* ── Hub: chat list ─────────────────────────────────────────────── */}
      <section
        aria-label="Chat list (hub)"
        className="relative px-screen pt-8 pb-28 text-white md:h-dvh md:overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <h1 className="text-display md:text-display-desktop">
            My
            <br />
            Chats
          </h1>
          <IconButton label="Menu" tone="hub">
            <Menu />
          </IconButton>
        </div>

        <div className="-mx-screen mt-6 flex gap-2 overflow-x-auto px-screen pb-1 [scrollbar-width:none]">
          {[
            ['All', 12],
            ['Unread', undefined],
            ['Groups', undefined],
            ['AI Picks', undefined],
          ].map(([label, count]) => (
            <FilterPill
              key={label as string}
              active={filter === label}
              count={count as number | undefined}
              onClick={() => setFilter(label as string)}
            >
              {label}
            </FilterPill>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-gap [grid-auto-flow:dense]">
          <ChatCard
            id="g1"
            variant="group"
            name="Hackathon Crew"
            color="coral"
            unread={48}
            items={items}
            page={0}
            pages={3}
          />
          <ChatCard
            id="m1"
            variant="media"
            name="Goa Trip ’26"
            color="periwinkle"
            unread={6}
            imageUrl="https://picsum.photos/id/1015/600/900"
            imageAlt="River valley photo shared in Goa Trip"
          />
          <ChatCard
            id="v1"
            variant="voice"
            name="Family"
            color="sage"
            unread={2}
            caption="Voice note · 0:42"
          />
          <ChatCard
            id="p1"
            variant="pinned"
            name="Meera Iyer"
            color="butter"
            unread={3}
            avatarSeed="meera"
          />
          <ChatCard
            id="t1"
            variant="text"
            name="Design Guild"
            color="mustard"
            unread={0}
            muted
            preview="Kiran: shipping the new tokens tonight 🚀"
            time="9:41"
          />
          <ChatCard
            id="t2"
            variant="text"
            name="Book Club"
            color="butter"
            unread={0}
            preview="Zoya: chapter 7 for next week"
            time="Yesterday"
          />
        </div>

        <div className="pointer-events-none sticky bottom-6 mt-[-40px] flex justify-end md:absolute md:right-screen md:bottom-6">
          <Fab
            open={fabOpen}
            onClick={() => setFabOpen((o) => !o)}
            className="pointer-events-auto"
          />
        </div>
      </section>

      {/* ── Content: conversation ─────────────────────────────────────── */}
      <section
        aria-label="Conversation (content)"
        className="flex h-dvh flex-col bg-cream text-ink md:rounded-l-sheet"
      >
        <ConversationTopBar
          title="Hackathon Crew"
          scrollRef={scrollRef}
          onBack={() => {}}
          right={
            <>
              <AvatarStack people={people} size={40} max={3} />
              <IconButton label="Chat info" className="-ml-3 ring-[3px] ring-cream" tone="primary">
                <MoreHorizontal />
              </IconButton>
            </>
          }
        />
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-screen">
          <ConversationTitle title="Hackathon Crew" subtitle="5 members · Meera, Kiran online" />
          <div className="mb-4 flex justify-center">
            <AiChip onClick={() => setSheetOpen(true)}>Catch me up · 48 new</AiChip>
          </div>
          <div className="flex flex-col gap-2 pb-4">
            <Bubble outgoing={false} author="Meera" time="9:12">
              Venue shortlist is in the doc — can everyone vote by tonight?
            </Bubble>
            <Bubble outgoing time="9:14" status="read">
              Voted! Going with the rooftop one 🌇
            </Bubble>
            <Bubble outgoing={false} author="Kiran" time="9:20" flash>
              Deadline for submission is Friday 6 PM, not midnight.
            </Bubble>
            <button
              type="button"
              className="self-start text-left"
              onClick={() => setMenuOpen(true)}
            >
              <Bubble outgoing={false} author="Zoya" time="9:31">
                Long-press me (or click) to see message actions
              </Bubble>
            </button>
            <Bubble outgoing time="9:32" status="delivered">
              On it
            </Bubble>
            <Bubble outgoing time="9:33" status="sent">
              Sharing the deck in 10
            </Bubble>
            <Bubble outgoing time="now" status="pending">
              Sending…
            </Bubble>
            <TypingIndicator name="Dev" seed="dev" />
          </div>
        </div>

        <div className="relative shrink-0">
          <div className="px-screen">
            <AiTray
              open={tool === 'replies' || tool === 'tone'}
              onClose={() => setTool(null)}
              aiEnabled={aiOn}
              onToggleAi={() => setAiOn((v) => !v)}
              translateActive
              stepper={
                <Stepper
                  label="Translate into"
                  options={LANGS}
                  value={lang}
                  onChange={setLang}
                  formatShort={(l) => LANG_SHORT[l]}
                />
              }
            >
              {tool === 'tone' ? (
                <p className="rounded-card bg-ink-raised p-4 text-body text-white">
                  <span
                    className="mr-2 inline-block size-2.5 rounded-pill bg-highlight"
                    aria-hidden
                  />
                  This might read as harsh. Try: “Could we revisit this together?”
                </p>
              ) : (
                <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
                  {['Sounds good 👍', 'I’ll vote tonight', 'Can we push to Saturday?'].map((s) => (
                    <SuggestionPill key={s} onClick={() => setDraft(s)}>
                      {s}
                    </SuggestionPill>
                  ))}
                </div>
              )}
            </AiTray>
          </div>
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => setDraft('')}
            activeTool={tool}
            onTool={(t) => setTool((cur) => (cur === t ? null : t))}
          />
        </div>
      </section>

      {/* ── Tokens ────────────────────────────────────────────────────── */}
      <section aria-label="Tokens" className="px-screen py-10 text-white md:col-span-2">
        <h2 className="text-title">Tokens</h2>
        <div className="mt-4 grid grid-cols-2 gap-gap sm:grid-cols-5">
          {cardPalette.map((c) => (
            <div key={c} className={`rounded-card p-4 text-ink ${cardBg[c]}`}>
              <p className="text-card-title">{c}</p>
              <p className="text-caption text-muted">{colors[c]}</p>
            </div>
          ))}
        </div>
        <div className="mt-gap grid grid-cols-2 gap-gap sm:grid-cols-4">
          <Swatch name="ink" cls="bg-ink ring-2 ring-white/20 text-white" />
          <Swatch name="cream" cls="bg-cream text-ink" />
          <Swatch name="cream-deep" cls="bg-cream-deep text-ink" />
          <Swatch name="highlight · AI" cls="bg-highlight text-ink" />
        </div>
        <ul className="mt-6 space-y-2">
          {Object.entries(type).map(([k, t]) => (
            <li key={k} className="flex items-baseline gap-4">
              <span className="w-32 shrink-0 text-caption text-white/55">
                {k} {t.size}/{t.lineHeight}
              </span>
              <span
                style={{
                  fontSize: t.size,
                  lineHeight: t.lineHeight,
                  fontWeight: t.weight,
                  letterSpacing: t.tracking,
                }}
              >
                Catch me up
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <IconButton label="Primary" tone="primary" className="ring-2 ring-white/20">
            <Sparkles />
          </IconButton>
          <IconButton label="Hub" tone="hub">
            <Sparkles />
          </IconButton>
          <IconButton label="Cream" tone="cream">
            <Sparkles />
          </IconButton>
          <IconButton label="AI" tone="ai">
            <Sparkles />
          </IconButton>
          <IconButton
            label="Open message actions"
            tone="cream"
            size="lg"
            onClick={() => setMenuOpen(true)}
          >
            <MoreHorizontal />
          </IconButton>
        </div>
      </section>

      <MessageMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={() => setMenuOpen(false)}
      >
        <Bubble outgoing={false} author="Zoya" time="9:31" marked>
          Long-press me (or click) to see message actions
        </Bubble>
      </MessageMenu>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="While you were away"
        eyebrow={
          <p className="mb-1 flex items-center gap-2 text-caption text-muted">
            <span aria-hidden className="size-2 rounded-pill bg-highlight" /> AI summary · 48
            messages
          </p>
        }
      >
        <p className="text-body">
          The crew picked the <b>rooftop venue</b>. Submission is due <b>Friday 6 PM</b>. Meera is
          finishing the <b>pitch deck</b> and wants feedback by Thursday.
        </p>
        <h3 className="mt-6 mb-2 text-card-title">Decisions</h3>
        <div className="flex flex-col gap-2">
          <RowPill icon={<Gavel />} onClick={() => setSheetOpen(false)}>
            Rooftop venue, 4 votes to 1
          </RowPill>
        </div>
        <h3 className="mt-6 mb-2 text-card-title">Deadlines</h3>
        <div className="flex flex-col gap-2">
          <RowPill icon={<CalendarClock />} onClick={() => setSheetOpen(false)}>
            Submission · Fri 6 PM
          </RowPill>
          <RowPill icon={<CalendarClock />} onClick={() => setSheetOpen(false)}>
            Deck feedback · Thu
          </RowPill>
        </div>
        <h3 className="mt-6 mb-2 text-card-title">Mentions</h3>
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <RowPill
              key={it.id}
              onClick={() =>
                setItems((all) => all.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))
              }
            >
              @you · {it.text}
            </RowPill>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Swatch({ name, cls }: { name: string; cls: string }) {
  return (
    <div className={`flex h-20 items-end rounded-card p-4 text-card-title ${cls}`}>{name}</div>
  );
}
