# Test Project

Next.js 16 + Payload CMS 3 on SQLite.

## Prerequisites

- Node.js 22+
- pnpm 10+

## Setup

```sh
git clone git@github.com:oblik/test-nextjs.git
cd ./test-nextjs
git checkout project
pnpm install
cp .env.example .env
pnpm seed
pnpm dev
```

Then:

- http://localhost:3000 should open a sample page
- http://localhost:3000/admin opens the CMS admin with credentials:
  - user: `admin@example.com`
  - pass: `password`

## Goal

The following pages render correctly:

- http://localhost:3000/
- http://localhost:3000/about
- http://localhost:3000/contact

However, this one is a 404:

- http://localhost:3000/foo/bar

How do we fix it?
