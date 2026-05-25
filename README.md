# Nexo Project

Next.js 16 + Payload CMS 3 on SQLite.

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- Payload CMS 3 (`@payloadcms/next`, `@payloadcms/db-sqlite`, `@payloadcms/richtext-lexical`)
- TypeScript, ESM (`"type": "module"`)

## Project layout

```
app/
├── (frontend)/          # Public site
│   ├── layout.tsx
│   ├── page.tsx         # Lists all CMS pages
│   └── [slug]/page.tsx  # Renders a single page by slug
├── (payload)/           # Generated Payload admin + API
│   ├── layout.tsx
│   ├── admin/[[...segments]]/...
│   └── api/...
payload.config.ts        # Collections: users (auth), pages
scripts/seed.ts          # Seeds an admin user + sample pages
```

## Prerequisites

- Node.js 22+
- pnpm 10+

## Setup from scratch

```bash
pnpm install
cp .env.example .env   # then edit PAYLOAD_SECRET to something random
pnpm seed              # creates the SQLite DB, admin user, and sample pages
pnpm dev
```

Then open:

- http://localhost:3000 — public site (lists CMS pages)
- http://localhost:3000/admin — Payload admin

Default seeded admin credentials:

- Email: `admin@example.com`
- Password: `password`

## Environment variables

Defined in `.env` (loaded automatically by Next.js and by the seed script via `node --env-file`):

| Var              | Default             | Purpose                                |
| ---------------- | ------------------- | -------------------------------------- |
| `PAYLOAD_SECRET` | _(required)_        | Used by Payload to sign tokens/cookies |
| `DATABASE_URI`   | `file:./payload.db` | SQLite connection string               |

## Scripts

| Command               | What it does                                    |
| --------------------- | ----------------------------------------------- |
| `pnpm dev`            | Start Next.js dev server (auto-migrates schema) |
| `pnpm build`          | Production build                                |
| `pnpm start`          | Run the production build                        |
| `pnpm seed`           | Create admin user + sample pages (idempotent)   |
| `pnpm generate:types` | Regenerate `payload-types.ts` from the config   |
| `pnpm lint`           | Run ESLint                                      |

## Adding content

1. Open `/admin` and log in.
2. Under **Pages**, create a new entry — set `title`, `slug`, and `content`.
3. The page is immediately reachable at `/<slug>` on the public site.

## Resetting the database

```bash
rm -f payload.db payload.db-journal
pnpm seed
```

## Notes

- Payload pulls and applies the schema from `payload.config.ts` on first connection — no manual migration step is required for local development.
- The seed script is invoked via `node --env-file=.env --import tsx` rather than `payload run`, because `payload run` silently no-ops on this Node 22 / pnpm / ESM combination.
