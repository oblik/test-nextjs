import type {
  CacheEntry,
  CacheHandler,
  Timestamp,
} from "next/dist/server/lib/cache-handlers/types";
import { LRUCache } from "next/dist/server/lib/lru-cache";
import {
  streamFromBuffer,
  streamToBuffer,
} from "next/dist/server/stream-utils/node-web-streams-helper";
import { createHash } from "node:crypto";
import { decode, encode } from "./compress";
import { replaceBuffers, reviveBuffers } from "./reviveBuffers";
import type { HandlerStorage } from "./storage/types";
import type { TagsManager, TagsManifest } from "./TagsManager";

const debug = process.env.NEXT_CACHE_S3_DEBUG
  ? console.debug.bind(console, "[next-cache-s3]:")
  : undefined;

type LRUCacheEntry = {
  entry: Omit<CacheEntry, "value">;
  value: Buffer;
  size: number;
};

export class Handler implements CacheHandler {
  buildId: string;
  storage: HandlerStorage;
  tagsManager: TagsManager;
  options: {
    name: string;
    lruSize: number;
    sticky: boolean;
    compress: boolean;
    base64: boolean;
  };

  lruCache?: LRUCache<LRUCacheEntry>;

  tags?: Readonly<TagsManifest>;

  /**
   * Inspired by the example custom cache handler implementation by Next.
   * @see https://github.com/vercel/next.js/blob/6ef6e29db5ec78704af1ea05a16b233bb7faac7c/packages/next/src/server/lib/cache-handlers/default.ts#L68
   */
  pendingSets = new Map<string, Promise<CacheEntry>>();

  constructor({
    buildId,
    storage,
    tagsManager,
    options,
  }: {
    buildId: string;
    storage: HandlerStorage;
    tagsManager: TagsManager;
    options: Handler["options"];
  }) {
    this.buildId = buildId;
    this.storage = storage;
    this.tagsManager = tagsManager;
    this.options = options;

    if (this.options.lruSize) {
      debug?.(`creating LRU cache with size ${this.options.lruSize} bytes`);
      this.lruCache = new LRUCache(
        this.options.lruSize,
        (v) => v.size,
        debug ? (k) => debug(`evicting ${k} from LRU cache`) : undefined,
      );
    }
  }

  async refreshTags() {
    this.tags = await this.tagsManager.getTags();
  }

  async get(
    cacheKey: string,
    softTags: string[],
  ): Promise<undefined | CacheEntry> {
    const filename = this.keyToFilename(cacheKey);

    const entry = await this.findEntry(filename);
    if (!entry) {
      debug?.(`get ${filename}: not found anywhere`);
      return undefined;
    }

    if (this.hasExpiredTags(entry.tags, entry.timestamp)) {
      debug?.(`get ${filename}: had an expired tag`);
      return undefined;
    }

    if (this.hasStaledTags(entry.tags, entry.timestamp)) {
      debug?.(`get ${filename}: had a staled tag`);
      entry.revalidate = -1;
    }

    return entry;
  }

  async findEntry(filename: string): Promise<CacheEntry | undefined> {
    const pendingPromise = this.pendingSets.get(filename);
    if (pendingPromise) {
      const entry = await pendingPromise;

      debug?.(`get ${filename}: copying pending entry stream`);
      const [streamCopy, value] = entry.value.tee();
      entry.value = streamCopy;

      return { ...entry, value };
    }

    if (this.lruCache) {
      const cachedEntry = this.lruCache.get(filename);
      if (cachedEntry) {
        debug?.(`get ${filename}: returning from LRU cache`);
        return {
          ...cachedEntry.entry,
          value: streamFromBuffer(cachedEntry.value),
        };
      }
    }

    debug?.(`get ${filename}: loading from storage`);
    const body = await this.storage.get(filename);
    if (!body) {
      debug?.(`get ${filename}: no file content`);
      return undefined;
    }

    const jsonString = this.options.compress
      ? await decode(body)
      : body.toString("utf-8");
    let json = JSON.parse(jsonString);

    if (!json || typeof json !== "object" || !("value" in json)) {
      debug?.(`get ${filename}: missing value in JSON`);
      return undefined;
    }

    json = reviveBuffers(json);

    return { ...json, value: streamFromBuffer(json.value) };
  }

  async set(
    cacheKey: string,
    pendingEntry: Promise<CacheEntry>,
  ): Promise<void> {
    const filename = this.keyToFilename(cacheKey);

    this.pendingSets.set(filename, pendingEntry);

    try {
      const entry = await pendingEntry;

      /**
       * Like the Next.js implementation.
       * @see https://github.com/vercel/next.js/blob/6ef6e29db5ec78704af1ea05a16b233bb7faac7c/packages/next/src/server/lib/cache-handlers/default.ts#L177
       */
      const { value: originalStream, ...metadata } = entry;
      const [streamCopy, valueStream] = originalStream.tee();
      entry.value = streamCopy;

      const value = await streamToBuffer(valueStream);
      const storedValue = { ...metadata, value };

      if (this.lruCache) {
        const size = value.byteLength;
        this.lruCache.set(filename, { entry: metadata, value, size });
        debug?.(
          `set ${filename}: saved ${size} bytes in LRU cache (${this.lruCache.currentSize} bytes total)`,
        );
      }

      const replacer = this.options.base64 ? replaceBuffers : undefined;
      const json = JSON.stringify(storedValue, replacer);
      const body = this.options.compress
        ? await encode(json)
        : Buffer.from(json, "utf-8");

      await this.storage.put(filename, body);
      debug?.(`set ${filename}: written to storage`);
    } finally {
      this.pendingSets.delete(filename);
      debug?.(`set ${filename}: deleted pending promise`);
    }
  }

  async getExpiration(tags: string[]): Promise<Timestamp> {
    // debug?.("getExpiration");
    return 0;
  }

  async updateTags(
    tags: string[],
    durations?: { expire?: number },
  ): Promise<void> {
    debug?.("updateTags:", tags, durations);
    const now = Date.now();
    const tagsCopy = { ...this.tags };

    for (const tag of tags) {
      const existingEntry = tagsCopy[tag];
      const newEntry = { ...existingEntry };

      if (durations) {
        newEntry.staled = now;

        if (durations.expire !== undefined) {
          newEntry.expired = now + durations.expire * 1000;
        }
      } else {
        newEntry.expired = now;
      }

      tagsCopy[tag] = newEntry;
    }

    await this.tagsManager.putTags(tagsCopy);
  }

  protected keyToFilename(cacheKey: string) {
    debugger;

    // By default, Next makes the build ID part of the cache key, so that cache
    // keys can vary across deploys, even if the cached function's code and
    // arguments stay the same. By removing the ID, we make the keys constant
    // across deploys, as long as the related code and arguments stay the same.
    /**
     * @todo The other part of the key based on the function code is constant
     * across builds only as long as the `.next/cache` directory stays the same.
     * So if two distinct servers build the same code, the keys would still
     * differ and the cache won't be sticky.
     * @see next.js/packages/next/src/server/use-cache/use-cache-wrapper.ts:1489
     */
    if (this.options.sticky) cacheKey = cacheKey.replace(this.buildId, "");

    const keyHash = createHash("md5").update(cacheKey).digest("hex");
    let filename = `${this.options.name}/${keyHash}.json`;

    if (!this.options.sticky) {
      filename =
        // Add a top-level `build` directory, so that artifacts don't flood the root
        // and make the manifest difficult to find.
        `build/` +
        // Then add the unique build ID, so that you can purge all artifacts
        // related to one specific build.
        `${this.buildId}/` +
        filename;
    }

    if (this.options.compress) filename += ".br";

    return filename;
  }

  protected hasExpiredTags(tags: string[], createdAt: Timestamp) {
    const now = Date.now();

    for (const tag of tags) {
      const entry = this.tags?.[tag];

      const expiredAt = entry?.expired;
      if (typeof expiredAt !== "number") continue;

      if (createdAt <= expiredAt && expiredAt <= now) return true;
    }

    return false;
  }

  protected hasStaledTags(tags: string[], createdAt: Timestamp) {
    for (const tag of tags) {
      const entry = this.tags?.[tag];

      const staledAt = entry?.staled;
      if (typeof staledAt !== "number") continue;

      if (createdAt <= staledAt) return true;
    }

    return false;
  }
}
