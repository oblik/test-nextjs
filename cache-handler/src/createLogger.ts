/**
 * Inspired by a similar implementation in Next:
 * @see https://github.com/vercel/next.js/blob/665d3458b616accd6e0ae942d794eb223273d616/packages/next/src/server/lib/cache-handlers/default.ts#L70-L72
 */
export function createLogger(scope: string) {
  if (!process.env.NEXT_CACHE_S3_DEBUG) return;

  return console.debug.bind(
    console,
    scope ? `[next-cache-s3/${scope}]` : `[next-cache-s3]`,
  );
}

export type Logger = ReturnType<typeof createLogger>;
