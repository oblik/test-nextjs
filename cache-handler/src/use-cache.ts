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
import { createLogger, type Logger } from "./debug";
import { replaceBuffers, reviveBuffers } from "./reviveBuffers";
import type { HandlerStorage } from "./storage/types";
import type { TagsManager, TagsManifest } from "./TagsManager";

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

  log: Logger;

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

    this.log = createLogger(`Handler/${this.options.name}`);

    if (this.options.lruSize) {
      this.log?.(`creating LRU cache with size ${this.options.lruSize} bytes`);
      this.lruCache = new LRUCache(
        this.options.lruSize,
        (v) => v.size,
        this.log ? (k: string) => this.log?.(`LRU: ${k} evicted`) : undefined,
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
      this.log?.(`get(${filename}): not found anywhere`);
      return undefined;
    }

    if (this.hasExpiredTags(entry.tags, entry.timestamp)) {
      this.log?.(`get(${filename}): had an expired tag`);
      return undefined;
    }

    if (this.hasStaledTags(entry.tags, entry.timestamp)) {
      this.log?.(`get(${filename}): had a staled tag`);
      entry.revalidate = -1;
    }

    return entry;
  }

  async findEntry(filename: string): Promise<CacheEntry | undefined> {
    const pendingPromise = this.pendingSets.get(filename);
    if (pendingPromise) {
      const entry = await pendingPromise;

      this.log?.(`findEntry(${filename}): copying from pending stream`);
      const [streamCopy, value] = entry.value.tee();
      entry.value = streamCopy;

      return { ...entry, value };
    }

    if (this.lruCache) {
      const cachedEntry = this.lruCache.get(filename);
      if (cachedEntry) {
        this.log?.(`findEntry(${filename}): returned from LRU cache`);
        return {
          ...cachedEntry.entry,
          value: streamFromBuffer(cachedEntry.value),
        };
      }
    }

    const body = await this.storage.get(filename);
    if (!body) {
      this.log?.(`findEntry(${filename}): no file content`);
      return undefined;
    }

    const jsonString = this.options.compress
      ? await decode(body)
      : body.toString("utf-8");
    const json = JSON.parse(jsonString) as unknown;

    if (!json || typeof json !== "object" || !("value" in json)) {
      this.log?.(`findEntry(${filename}): missing value in JSON`);
      return undefined;
    }

    const typedJson = reviveBuffers(json) as Omit<CacheEntry, "value"> & {
      value: Buffer;
    };

    if (this.lruCache) {
      const { value, ...metadata } = typedJson;
      const size = value.byteLength;
      this.lruCache.set(filename, { entry: metadata, value, size });
      this.log?.(
        `get(${filename}): saved ${size} bytes in LRU cache (${this.lruCache.currentSize} bytes total)`,
      );
    }

    return { ...typedJson, value: streamFromBuffer(typedJson.value) };
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
        this.log?.(
          `set(${filename}): saved ${size} bytes in LRU cache (${this.lruCache.currentSize} bytes total)`,
        );
      }

      const replacer = this.options.base64 ? replaceBuffers : undefined;
      const json = JSON.stringify(storedValue, replacer);
      const body = this.options.compress
        ? await encode(json)
        : Buffer.from(json, "utf-8");

      await this.storage.put(filename, body);
    } finally {
      this.pendingSets.delete(filename);
      this.log?.(`set(${filename}): deleted pending promise`);
    }
  }

  async getExpiration(tags: string[]): Promise<Timestamp> {
    return 0;
  }

  async updateTags(
    tags: string[],
    durations?: { expire?: number },
  ): Promise<void> {
    this.log?.("updateTags:", tags, durations);
    const now = Date.now();
    const tagsCopy = { ...this.tags };

    for (const tag of tags) {
      const existingEntry = tagsCopy[tag];
      const newEntry = { ...existingEntry };

      if (durations) {
        newEntry.stalesAt = now;

        if (durations.expire !== undefined) {
          newEntry.expiresAt = now + durations.expire * 1000;
        }
      } else {
        newEntry.expiresAt = now;
      }

      tagsCopy[tag] = newEntry;
    }

    await this.tagsManager.putTags(tagsCopy);
  }

  protected keyToFilename(cacheKey: string) {
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

      const expiredAt = entry?.expiresAt;
      if (typeof expiredAt !== "number") continue;

      if (createdAt <= expiredAt && expiredAt <= now) return true;
    }

    return false;
  }

  protected hasStaledTags(tags: string[], createdAt: Timestamp) {
    for (const tag of tags) {
      const entry = this.tags?.[tag];

      const staledAt = entry?.stalesAt;
      if (typeof staledAt !== "number") continue;

      if (createdAt <= staledAt) return true;
    }

    return false;
  }
}
