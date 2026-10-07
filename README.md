# Pulse

Real-time chat on Aiven with an AI layer for catching up on busy chats. See `CLAUDE.md` for the full spec.

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in Aiven values (see comments in the file)
pnpm health            # OK/FAIL for MySQL, PostgreSQL, Kafka, Valkey, OpenSearch
pnpm dev               # web → http://localhost:3100 · api → http://localhost:4100
```

## Workspace

| Path              | What                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `apps/web`        | Next.js (App Router) + Tailwind v4 + shadcn/ui + Framer Motion     |
| `apps/api`        | Express + Socket.IO gateway and REST                               |
| `apps/worker`     | Kafka consumers and AI jobs                                        |
| `packages/shared` | zod env schemas, Kafka topic names, shared types                   |
| `packages/aiven`  | TLS connection factories for every Aiven service + `pnpm health`   |
| `packages/ui`     | Design tokens (`tokens.ts` → generated `tokens.css` / `theme.css`) |

## Scripts

`pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm format` · `pnpm tokens` (regenerate CSS after editing `packages/ui/src/tokens.ts`)
