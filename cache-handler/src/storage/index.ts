import { join } from "node:path";
import { FsStorage } from "./fs";
import { S3Storage } from "./s3";
import type { HandlerStorage } from "./types";

/**
 * Picks the storage backend. This has to happen at **runtime** (not in
 * `next.config.ts`) because Elastic Beanstalk env vars are only available once
 * the container is running, not during `next build`.
 *
 * - `CACHE_S3_BUCKET` set → S3 (stage/prod)
 * - otherwise → local filesystem, at `.next/cache/cache-handler`
 */
export function createStorage(serverDistDir: string): HandlerStorage {
  const { CACHE_S3_BUCKET, CACHE_S3_REGION } = process.env;

  if (CACHE_S3_BUCKET && CACHE_S3_REGION) {
    console.log(`Using S3 storage (bucket ${CACHE_S3_BUCKET})`);
    return new S3Storage({
      bucket: CACHE_S3_BUCKET,
      region: CACHE_S3_REGION,
    });
  }

  // `.next/cache` is the one directory `next build` preserves between builds,
  // and in Docker `/app/.next` is the only directory writable by the runtime
  // user, so it works out of the box in both places.
  const root = join(
    /*turbopackIgnore: true*/ serverDistDir,
    "..",
    "cache",
    "cache-handler",
  );

  console.log(`Using filesystem storage at ${root}`);
  return new FsStorage(root);
}
