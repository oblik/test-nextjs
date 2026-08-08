# Next.js dynamic `/sitemap` route conflicts with `sitemap.ts`

Minimal reproduction of a Turbopack routing conflict in Next.js `16.3.0`.

The application contains:

- `src/app/sitemap.ts`, which serves the XML sitemap at `/sitemap.xml`.
- `src/app/(site)/sitemap/[...attrs]/page.tsx`, which renders an HTML sitemap.
- `src/proxy.ts`, which rewrites the public `/sitemap` URL to the dynamic HTML
  route with serialized attributes.

## Reproduction

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000/sitemap
```

## Actual behavior

The request returns `500` and Next.js tries to resolve the dynamic path as a
generated sitemap metadata route:

```text
Error: ENOENT: no such file or directory, open
'.next/dev/server/app/sitemap/[__metadata_id__]/[__metadata_id__]/route/app-paths-manifest.json'
```

The XML sitemap remains available at:

```text
http://localhost:3000/sitemap.xml
```

## Expected behavior

- `/sitemap` should render the dynamic HTML sitemap page.
- `/sitemap.xml` should render the metadata sitemap.
- The two routes should coexist without the dynamic HTML route being interpreted
  as a sitemap metadata route.

## Relevant files

```text
src/
├── app/
│   ├── (site)/
│   │   └── sitemap/
│   │       └── [...attrs]/
│   │           └── page.tsx
│   └── sitemap.ts
└── proxy.ts
```

## Related reports

- https://github.com/vercel/next.js/issues/78609
- https://github.com/vercel/next.js/discussions/74055

The existing reports cover similar sitemap route collisions. This reproduction
demonstrates the remaining conflict when the HTML sitemap uses a dynamic
catch-all route behind a proxy rewrite.
