# Pulse

Real-time chat built entirely on Aiven, with an AI layer that helps you catch up on busy chats. The bold bento design uses black hub screens with pastel cards and cream conversation screens.

## Architecture

```
Phone / laptop ──Socket.IO──▶ API (Express + Socket.IO, zod-validated)
     ▲                          │ membership check (Valkey cache → MySQL)
     │                          ▼
     │                   Kafka: messages.sent (key = conversation_id)
     │                          │
     │        ┌─────────────────┼──────────────────┐
     │        ▼                 ▼                  ▼
     │   fanout consumer    db-writer          (ai.jobs / analytics.events)
     │   Valkey emitter     MySQL INSERT IGNORE
     └── Valkey adapter ◀── unread, chat order, presence
```

- **Send:** the client generates a ULID and emits over the WebSocket. The API checks membership in Valkey (falling back to MySQL) and produces to `messages.sent`, partitioned by conversation. The **fanout** consumer pushes to every member through the Socket.IO Valkey adapter. The **db-writer** consumer persists to MySQL.
- **Receipts:** the client acks to `messages.receipts`. The receipts consumer advances each member's forward-only delivered/read watermarks, and senders' ticks update live (pending → sent → delivered → read).
- **Idempotency:** Kafka delivers at least once, so consumers dedupe by message ID (`INSERT IGNORE`, `SET NX` markers).
- **Derived views:** MySQL is the source of truth. Valkey caches rebuild from MySQL on a miss.
- **Reconnects:** socket.io state recovery handles short drops; otherwise the client fetches `?after=<last id>` for each open chat and resends anything unacked.

| Aiven service             | What it does in Pulse                                                                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MySQL**                 | Source of truth: users, conversations, members (with read/delivered watermarks), messages, media, reactions, moments                                 |
| **Apache Kafka**          | `messages.sent`, `messages.receipts`, `presence.events`, `ai.jobs`, `analytics.events` (the free tier's five topics)                                 |
| **Valkey**                | Socket.IO adapter for multi-instance fan-out, presence TTLs, typing, unread counters, chat-list order, sessions, OTPs, rate limits, AI summary cache |
| **PostgreSQL + pgvector** | Message embeddings for semantic search (`message_embeddings`, HNSW cosine index)                                                                     |
| **OpenSearch**            | Keyword search index (planned; see Status)                                                                                                           |

The in-app **Under the Hood** page (account menu) shows live Kafka throughput and consumer lag, the Valkey hit rate, and MySQL counts.

## Setup

```bash
pnpm install
cp .env.example .env        # each variable notes its Aiven console field
pnpm health                 # OK/FAIL for every Aiven service
pnpm migrate                # MySQL + pgvector schema
pnpm seed                   # judge accounts + multilingual demo chats (--reset to recreate)
pnpm dev                    # web http://localhost:3100 · api :4100 · worker
```

Copy `apps/web/.env.example` to `apps/web/.env.local`.

## Deploy

1. Push this repo to GitHub.
2. **Render:** New → Blueprint, then pick the repo. `render.yaml` creates `pulse-api` and `pulse-worker`. Fill in the secret env vars, using the `*_CA_CERT_BASE64` variants for the CA certificate. Set `WEB_ORIGIN` to the Vercel URL, and `KEEP_WARM_URLS` to `https://<worker>.onrender.com/healthz`.
3. **Vercel:** New Project → the repo, root directory `apps/web`. Env: `API_URL` and `NEXT_PUBLIC_API_URL` = the Render API URL.
4. Run `pnpm seed` once against production (from your machine, with the production `.env`).

## Demo script (3 min)

1. Open the app on two devices and tap **Try as judge** with Asha on one and Rohan on the other. Message each other and watch the ticks go grey → double → blue, with typing and online status.
2. Tap the **Hackathon Crew** card to open the conversation.
3. Tap **Catch me up** to get the summary, decisions and deadlines. Tap a deadline: the app scrolls to its source message and flashes it.
4. Open the account menu → **Under the hood** to see the live Kafka lag, Valkey hit rate and MySQL counts.

## Quality gates

`pnpm lint` (includes a no-mock-data guard) · `pnpm typecheck` · `pnpm test` · `pnpm build`

## Status

Built and tested (lint, typecheck, 52 unit tests, production builds), but **not yet run against live Aiven services**:

- Auth (judge demo login, email OTP, rotating refresh sessions), 1:1 and group chat, real-time delivery through Kafka, ticks, typing, presence, unread counts, pinned chats, photo messages, Catch Me Up, Under the Hood, and the seed data.

Not built yet:

- Media upload (Cloudinary), OpenSearch keyword search, Ask Your Chats (pgvector embeddings), Live Translate, Smart Replies, Tone Check, Moments, Chat Pulse, reactions, reply/edit/delete, Web Push, and the card-to-chat shared-element transition.
