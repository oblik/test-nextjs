# next-cache-s3

A [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) implementation for Next.js 16 [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).

## Setup

1. Copy `.env.example` to `.env`
2. `pnpm build && pnpm start`
3. Play around at http://localhost:3000

**Note:** The cache handler must be pre-built (the `prebuild` script in `package.json`) because it's not a part of Next.js's build process. As you can see in [the docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers#usage) it must be specified in the Next config with `require.resolve` pointing to a plain JS file:

```ts
const nextConfig: NextConfig = {
  cacheHandlers: {
    default: require.resolve("./cache-handlers/default-handler.js"),
    remote: require.resolve("./cache-handlers/remote-handler.js"),
  },
};
```

## Features

- LRU cache in addition to S3, to reduce network overhead
- Tags manifest syncing with LRU and stale-while-revalidate
- Sticky handlers (for caching across builds)
- Optimizations:
  - Brotli compression
  - base64 encoding

## TODO

Must-haves:

- `softTags` support
- Fix sticky cache not always being sticky due to `.next/cache`
  - Maybe fixable by passing [`deploymentId`](https://nextjs.org/docs/app/api-reference/directives/use-cache#cache-keys)
  - If not, the function hash can also be removed and only the function args can be used as cache key
- Discard partial entries, since according to the JSDoc of the `CacheEntry.value` type:
  > The stream can error and deliver partial data. Each handler decides whether it keeps the partial entry or discards it.

Optimizations:

- Add ETag checking in S3 storage to avoid extra network overhead
- Sniff the cache value and if starts with `0:{`, assume it's just a JSON response and serialize it not as a buffer, but as regular JSON, so it compresses better?

Tests:

- When the tags manifest loads, there's a pre-existing stale tag. The tags should get updated without explicitly getting mutated (revalidated) by the user code.
- When `revalidateTag` is called and there are more than 1 cache handlers registered, the tags manifest should be updated just once, not one time per handler.
- …and many more
