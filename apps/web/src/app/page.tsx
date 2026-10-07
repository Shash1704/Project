import { cardPalette, colors, radii, type } from '@pulse/ui/tokens';
import { cn } from '@/lib/utils';

const swatchBg: Record<(typeof cardPalette)[number], string> = {
  coral: 'bg-coral',
  mustard: 'bg-mustard',
  sage: 'bg-sage',
  periwinkle: 'bg-periwinkle',
  butter: 'bg-butter',
};

/** Phase 0 token check. Replaced by the full /design-preview in Phase 1. */
export default function TokensPage() {
  return (
    <main className="mx-auto max-w-3xl px-screen py-10">
      <h1 className="text-display md:text-display-desktop">
        Pulse
        <br />
        Tokens
      </h1>
      <p className="mt-3 text-caption text-white/60">Phase 0 · design foundation check</p>

      <section aria-label="Card palette" className="mt-8 grid grid-cols-2 gap-gap">
        {cardPalette.map((name, i) => (
          <div
            key={name}
            className={cn(
              'relative rounded-card p-5 pt-7 text-ink',
              swatchBg[name],
              i === 0 && 'col-span-2',
            )}
          >
            <span
              aria-hidden
              className="absolute top-2.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-pill bg-ink/20"
            />
            <p className="text-card-title">{name}</p>
            <p className="text-caption text-muted">{colors[name]}</p>
          </div>
        ))}
      </section>

      <section aria-label="Content surface" className="mt-gap rounded-card bg-cream p-5 text-ink">
        <p className="text-title">Content screens</p>
        <div className="mt-4 flex flex-col gap-2">
          <p className="self-start rounded-bubble bg-cream-deep px-4 py-2.5 text-body">
            Incoming bubble on cream-deep
          </p>
          <p className="self-end rounded-bubble bg-ink px-4 py-2.5 text-body text-cream">
            Outgoing bubble on ink
          </p>
          <p className="self-start rounded-pill bg-highlight px-3 py-1 text-caption">
            AI highlight
          </p>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            aria-label="Attach"
            className="size-icon-button rounded-pill bg-ink text-cream"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Camera"
            className="size-icon-button rounded-pill bg-taupe-glass"
          />
          <button
            type="button"
            aria-label="Tone check"
            className="size-icon-button rounded-pill bg-taupe-glass"
          />
        </div>
      </section>

      <section aria-label="Type scale" className="mt-8 space-y-1 text-caption text-white/60">
        {Object.entries(type).map(([name, t]) => (
          <p key={name}>
            {name} · {t.size}/{t.lineHeight} · {t.weight}
          </p>
        ))}
        <p>
          radii · card {radii.card} · bubble {radii.bubble} · sheet {radii.sheet} · pill{' '}
          {radii.pill}
        </p>
      </section>
    </main>
  );
}
