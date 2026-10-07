# CLAUDE.md — Pulse (real-time chat app on Aiven)

This file is the single source of truth for this project. Re-read it at the start of every session and before every phase. If something here conflicts with a request in chat, ask me before deviating.

## 1. What we are building

Pulse is a production-quality, real-time chat app similar to WhatsApp, built for a competition. Its whole data layer runs on Aiven, it has a bold bento-style visual design, and its differentiator is an AI layer that helps people catch up on, search and understand busy chats.

### Judging criteria (optimise every decision for these)
1. The project must be LIVE at a public URL that works on phones and laptops.
2. UI/UX design is judged. It must look polished and intentional, never like a template.
3. Aiven must be used heavily. Every Aiven service must do real, visible work.
4. Innovation: AI features that WhatsApp does not have.

## 2. How to work with me (Claude Code working agreement)

- Work in the phases in section 10. Start each phase in plan mode: show me the plan, wait for approval, then build.
- Stop at the end of every phase. Report: what was built, how I can test it, env vars I must add, known issues. Wait for my "go" before the next phase.
- Verify your own work before calling a phase done: run the app, run the tests, and check the UI in a real browser (use the Playwright MCP server if it is configured; otherwise tell me exactly what to check and ask me for screenshots).
- Commit at the end of each phase with a clear message. Never commit secrets.
- Keep the "Progress log" at the bottom of this file updated: one dated line per phase with status and open issues.
- Prefer small, focused changes. Do not rewrite working code unless the phase requires it.
- No TODOs, stubs or mock data left in features marked done.
- If you are unsure about a requirement, ask instead of guessing.

## 3. Tech stack (use exactly this unless you ask first)

- Monorepo with pnpm workspaces:
  - `/apps/web`: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Framer Motion, installable as a PWA
  - `/apps/api`: Node.js + TypeScript + Express + Socket.IO (WebSocket gateway + REST)
  - `/apps/worker`: Node.js + TypeScript background consumers (Kafka consumers, AI jobs)
  - `/packages/shared`: shared types, zod schemas, event definitions
  - `/packages/ui`: design tokens and shared UI primitives
- Aiven data layer (all connections TLS-only):
  - **Aiven for MySQL**: source of truth (users, conversations, members, messages, receipts, media, moments). Driver: `mysql2/promise`, connection pool, `ssl.ca` from the CA cert.
  - **Aiven for PostgreSQL + pgvector**: message embeddings for semantic search only.
  - **Aiven for Apache Kafka**: event backbone, via `kafkajs`. The free tier allows only 5 topics, so use exactly: `messages.sent`, `messages.receipts`, `presence.events`, `ai.jobs`, `analytics.events`.
  - **Aiven for Valkey**: presence (TTL keys), typing indicators, unread counters, chat-list sorted sets, sessions, rate limiting, AI result caches, and the Socket.IO adapter for multi-instance fan-out. Library: `ioredis` over `rediss://`.
  - **Aiven for OpenSearch**: full-text keyword search across messages.
- AI: an LLM API for summaries, translation and smart replies, and an embeddings API for vectors. Wrap both behind a provider interface in `/apps/worker/src/ai` so the provider and model are chosen by env var.
- Media: Cloudinary (or any S3-compatible storage). Store only metadata in MySQL.
- Hosting: web on Vercel; api + worker on Render (or Railway).

## 4. Secrets (strict)

- Never hardcode, log or print credentials. Read everything from environment variables.
- Create `.env.example` files listing every variable with placeholder values, and tell me exactly which Aiven console field goes into which variable.
- Add `.env*`, `*.pem`, `*.key`, `*.cert` to `.gitignore` before the first commit.
- Load CA certificates from either a file path or a base64 env var, so they work on hosts without secret files.
- Never ask me to paste passwords into chat. I will put them in `.env` myself.

## 5. Architecture

- **Send flow:** client emits over WebSocket with a client-generated ULID → API checks membership (cached in Valkey) → produce to `messages.sent` (partition key = `conversation_id`) → fan-out consumer pushes to recipients via Socket.IO + Valkey adapter → DB writer persists to MySQL → indexer writes to OpenSearch → embedding worker writes to PostgreSQL/pgvector.
- **Receipts:** recipient clients ack → `messages.receipts` → sender's ticks update (sent → delivered → read).
- MySQL is the source of truth. Valkey, OpenSearch and pgvector are derived views and must be rebuildable from MySQL with a script.
- Consumers must be idempotent (dedupe by message ID), because Kafka delivers at least once.
- Client UI is optimistic: a sent message appears instantly with a grey tick, then reconciles.
- On reconnect, the client fetches messages missed since its last message ID.
- Index `messages` on `(conversation_id, created_at)` so loading recent history stays fast.

## 6. Features

**P0 (must be flawless):**
- Email OTP login (OTP in Valkey with TTL) and a one-tap "Try as judge" demo login with seeded accounts
- 1:1 chat and group chat (create, add/remove members, admins, avatar)
- Sent / delivered / read ticks; online, last seen, typing…
- Chat list sorted by latest message, unread badges, pinned chats
- Image, document and voice-note sharing with previews
- Keyword search (OpenSearch) with highlighted results

**P1:** reactions, reply-to, edit, delete-for-everyone, Web Push notifications.

**Innovation (the differentiator; each must be demoable in under a minute):**
- **Catch Me Up:** in a group with many unread messages, show a chip. Tapping it opens a sheet with a 5-line summary, decisions, deadlines and @mentions. Each point links to its source message. Cache as `summary:{conv}:{last_msg_id}` in Valkey.
- **Ask Your Chats:** natural-language semantic search with pgvector cosine similarity, scoped to chats the user belongs to.
- **Live Translate:** per-message toggle into the user's preferred language (English, Hindi, Kannada, Tamil at minimum). Cache as `tr:{msg}:{lang}` in Valkey.
- **Smart Replies** (3 suggestions) and **Tone Check** (a gentle warning before sending a harsh message).
- **Moments:** auto-extract dates, links, places and tasks into a per-chat "Moments" tab.
- **Chat Pulse:** per-group insights (messages per hour, top contributors, weekly mood trend) built from `analytics.events`.
- **Under the Hood page:** live Kafka throughput and consumer lag, Valkey hit rate, message counts, and an architecture diagram. This proves Aiven usage to the judges.
- AI features run only on chats where the user has opted in (per-chat toggle).

## 7. Design system — visual direction

The visual reference is `/design/reference.png` (a notes-app concept I will add to the repo). Treat it as a style reference, not something to copy: reuse its design language and apply it to a chat app. Do not reproduce its text, photos or avatar art. Compare your screens against it throughout.

### 7.1 What defines this style (match all of it)
- **Two-world contrast:** "hub" screens (the chat list) are pure black with saturated pastel cards. "Content" screens (an open chat) are warm cream with black type.
- **Huge, chunky, rounded shapes:** cards ~32 px radius; buttons are perfect circles or full pills. Almost no sharp corners, no 1 px dividers.
- **Bento layout:** cards of different sizes in a 2-column grid, some spanning full width.
- **Oversized geometric sans headings** (40–56 px, line-height ~1.05, slight negative letter-spacing) paired with small, quiet body text.
- **Flat colour blocks:** no gradients, no drop shadows on cards. Depth comes only from colour contrast and overlap (a FAB over the edge of a card, stacked avatars).
- **Icons inside circles:** every icon button is a 44–56 px circle, either black with a white icon (primary) or translucent taupe/cream (secondary).
- **Playful details:** a small drag-handle notch at the top centre of each card, round checkboxes, small circular buttons in card corners, friendly illustrated avatars.

### 7.2 Design tokens
Create `/packages/ui/tokens.ts` plus matching CSS variables. Never hardcode colours, radii or font sizes in components.

Colours (approximate from the reference; tune by eye against it):
- `ink` #0B0B0B (hub background, primary buttons, text on light)
- `cream` #F8EFC8 (content screen background)
- `cream-deep` #EFE3B5 (pills and rows on cream)
- `taupe-glass` rgba(120,110,90,0.25) (secondary circular buttons on cream)
- Card palette: `coral` #E9775A · `mustard` #F3CB48 · `sage` #A9D68C · `periwinkle` #9EB6EC · `butter` #F7EDC2
- `highlight` #F6D34A (text selection, AI highlights)
- `muted` rgba(11,11,11,0.55) (secondary text on colour)

Each conversation gets one card colour from the palette, assigned from a stable hash of its ID.
**AI accent:** mustard/highlight is reserved for AI features (the AI dot, AI highlights, Catch Me Up chip), so AI output is always recognisable.

Radii: card 32 · pill 999 · bubble 24 · sheet 36
Spacing: 4-pt scale; screen padding 20; grid gap 10
Type: "Lexend" (or "Outfit") from Google Fonts, with system fallbacks.
- display 48/1.05 semibold, −0.02em
- title 28/1.1 semibold
- card-title 15/1.25 semibold
- body 15/1.5 regular
- caption 12/1.3 regular, muted

Motion (Framer Motion): springs, not linear easing (stiffness ~400, damping ~32). Respect `prefers-reduced-motion`.

### 7.3 Screens
**A. Chat list (home)**
- Black background. Giant two-line title "My / Chats" top-left; circular dark-grey menu button top-right.
- Horizontally scrolling outline filter pills: "All (count)", "Unread", "Groups", "AI Picks". Active pill: white outline and text; inactive: dimmed.
- Bento grid of chats as coloured cards:
  - Group card (square): name as card-title, then 2–3 Catch Me Up action items as round-checkbox rows, with pagination dots at the bottom.
  - Media card (tall): when the latest message is a photo, the photo fills the card with the group name overlaid top-left.
  - Pinned 1:1 chat (full-width cream pill): avatar circle left, caption "3 new", name in card-title, circular pin button right.
  - Voice-note card: shows a circular mic button over the card.
- Each card has a notch handle at the top and a small circular icon in the top-right (unread count or mute).
- A black circular FAB (64 px, white "+") overlapping the edge of a card at the bottom right, with a 4 px black ring so it reads as cut out of the card.

**B. Conversation**
- Cream background (or a very light tint of the chat's card colour; choose one approach and keep it consistent).
- Top bar: circular taupe back button left; overlapping member avatars right (−12 px overlap), ending in a circular action button.
- Chat name as a giant display heading under the top bar; it collapses into a compact title on scroll (animated).
- Incoming bubbles: `cream-deep`, radius 24, black text. Outgoing: `ink` with cream text. Ticks and timestamps in caption size.
- Typing indicator: a small floating avatar bubble.
- Composer: a "Tap here to type…" line with a thin black caret marker, and below it a pill toolbar: black circular "+" (attach), then taupe circles for camera, pen (Tone Check) and list (Smart Replies).

**C. Message actions**
- Long-press a message: the rest of the chat blurs, the message gets a yellow highlighter-style marker (`highlight`, slightly irregular padding), and a floating pill menu appears above it with circular icons: reply, copy, translate, react.

**D. AI tools tray**
- A floating black panel (radius 36) docked above the keyboard area, opened from the composer.
- Top row of circular controls: "Aa" (formatting), a mustard dot (AI on/off for this chat), translate, and a segmented stepper for language or tone where the selected value is large and bright and its neighbours small and dim.
- Smart-reply suggestions appear as cream pills inside the panel.

**E. Catch Me Up sheet**
- Bottom sheet (cream, top radius 36): display heading "While you were away", a short summary with key words bolded, then decisions and deadlines as `cream-deep` pill rows. Tapping a row scrolls to the source message and briefly flashes it with `highlight`.

**F. Everything else** (Ask Your Chats, Group info + Chat Pulse + Moments, Under the Hood, Settings, Onboarding): same rules. Black hub screens with coloured bento cards; cream content screens; circles and pills only; giant headings. Chat Pulse charts use the card palette with flat fills and rounded bar ends. Onboarding: 3 slides, a "Try as judge" button and a language picker.

### 7.4 Signature interactions (judges will notice these)
- Tapping a chat card triggers a shared-element transition (Framer Motion `layoutId`): the card expands to fill the screen, its colour morphs into the conversation background, and the chat name grows into the display heading. Reverse on back.
- Card press: scale to 0.97 with a spring. FAB: "+" rotates 45° when the new-chat menu opens.
- New message: slide up and fade in (~150 ms); outgoing bubbles get a tiny overshoot bounce.
- Skeleton loaders instead of spinners; meaningful empty states with one clear action.

### 7.5 Avatars and imagery
- Use open-licensed generated avatars (e.g. DiceBear) in a friendly illustrated style, inside circles with a cream ring. Never use Apple Memoji or images from the reference.
- Seed data includes photo messages so media cards appear on the home grid.

### 7.6 Accessibility (non-negotiable)
- Text on every card colour meets WCAG 2.1 AA (ink on pastels; check mustard and sage specifically).
- Minimum touch target 44 px; every icon-only circle has an `aria-label`.
- Never rely on colour alone: unread state also uses a count badge.
- Full keyboard navigation; text scales to 200% without breaking layouts.

### 7.7 Desktop layout
- Left column (380 px): the black bento chat list. Right: the cream conversation. The AI tray floats bottom-centre of the conversation pane. Display headings scale down to 40 px.
- Test every screen at 390 px (mobile) and 1440 px (desktop).

## 8. Security

- Short-lived JWT access tokens + refresh tokens in httpOnly cookies; sessions revocable via Valkey.
- Every read and write checks conversation membership on the server.
- Parameterised SQL only, never string concatenation.
- Per-user rate limits in Valkey; upload limits (25 MB, allowed MIME types only).
- Validate every socket and REST payload with zod.

## 9. Quality bar (every phase)

- Run the app and verify it yourself before saying a phase is done, at mobile and desktop sizes.
- Tests for the message pipeline (send → persist → deliver → receipt).
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- For UI work: take screenshots, compare them with `/design/reference.png`, and list remaining differences.

## 10. Phases (stop after each one and wait for my "go")

**Phase 0 – Setup**
Monorepo scaffold, lint/format/typecheck, `.env.example` files, and a health-check script (`pnpm health`) that connects to every Aiven service and prints OK/FAIL for each. Tell me exactly which Aiven services to create and which console fields map to which env vars. Set up design tokens and fonts in `/packages/ui`.

**Phase 1 – Live skeleton + design foundation**
Build `/design-preview`: a page showing every token, card variant, button, bubble, pill, the context menu and the AI tray. Compare it with the reference and fix differences first. Then auth, demo login, and 1:1 chat end-to-end through Kafka, styled with the design system and deployed to public URLs. **The app must be live at the end of this phase.**

**Phase 2 – WhatsApp parity**
Groups, receipts, presence, typing, unread counts, media, OpenSearch search. Chat list as the full bento grid; conversation screen per 7.3B.

**Phase 3 – Design polish**
Message actions, shared-element transition, all animations, empty states, skeletons, accessibility pass, desktop layout. Do not change backend logic, socket events or data flow in this phase.

**Phase 4 – Innovation**
Catch Me Up, Ask Your Chats, Live Translate, Smart Replies + Tone Check, Moments, AI tools tray.

**Phase 5 – Proof and polish**
Chat Pulse, Under the Hood, a seed script (3 judge accounts; 5 groups with realistic multilingual English/Hindi/Kannada history; at least one group with 150+ messages), load test, keep-alive pings so free-tier services don't power off, README.

## 11. Final deliverables

- Public live URL with working demo login
- README: architecture diagram, a table of every Aiven service and its job, setup steps, screenshots
- A 3-minute demo script: real-time ticks across two devices → card-to-chat transition → Catch Me Up on a busy group → semantic search → Live Translate → Under the Hood dashboard

## Progress log

<!-- One dated line per phase: YYYY-MM-DD — Phase N — status — open issues -->
2026-10-07 — Phase 0 — done — awaiting Aiven services + `.env` to see `pnpm health` go 5×OK; `muted` raised to 0.74 alpha for AA; `/design/reference.png` not yet added
