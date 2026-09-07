import type {
  CacheEntry,
  CacheHandler,
  Timestamp,
} from "next/dist/server/lib/cache-handlers/types";
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

export const hasExpiredTags = (
  handlerTags: TagsManifest[string],
  tags: string[],
  createdAt: Timestamp,
) => {
  const now = Date.now();

  for (const tag of tags) {
    const entry = handlerTags[tag];

    const expiredAt = entry?.expired;
    if (typeof expiredAt !== "number") continue;

    if (createdAt <= expiredAt && expiredAt <= now) return true;
  }

  return false;
};

export const hasStaledTags = (
  handlerTags: TagsManifest[string],
  tags: string[],
  createdAt: Timestamp,
) => {
  for (const tag of tags) {
    const entry = handlerTags[tag];

    const staledAt = entry?.staled;
    if (typeof staledAt !== "number") continue;

    if (createdAt <= staledAt) return true;
  }

  return false;
};

export class Handler implements CacheHandler {
  buildId: string;
  storage: HandlerStorage;
  tags: TagsManager;
  options: {
    name: string;
    compress: boolean;
    base64: boolean;
  };

  tagEntries?: Readonly<TagsManifest[string]>;

  /**
   * Inspired by the example custom cache handler implementation by Next.
   * @see https://github.com/vercel/next.js/blob/6ef6e29db5ec78704af1ea05a16b233bb7faac7c/packages/next/src/server/lib/cache-handlers/default.ts#L68
   */
  pendingSets = new Map<string, Promise<CacheEntry>>();

  constructor({
    buildId,
    storage,
    tags,
    options,
  }: {
    buildId: string;
    storage: HandlerStorage;
    tags: TagsManager;
    options: Handler["options"];
  }) {
    this.buildId = buildId;
    this.storage = storage;
    this.tags = tags;
    this.options = options;
  }

  async refreshTags() {
    debug?.("refreshing tags");
    this.tagEntries = await this.tags.getTags(this.options.name);
  }

  async get(
    cacheKey: string,
    softTags: string[],
  ): Promise<undefined | CacheEntry> {
    const filename = this.keyToFilename(cacheKey);

    const pendingPromise = this.pendingSets.get(filename);
    if (pendingPromise) {
      const entry = await pendingPromise;

      debug?.(`get ${filename}: copying pending entry stream`);
      const [streamCopy, value] = entry.value.tee();
      entry.value = streamCopy;

      return { ...entry, value };
    }

    const body = await this.storage.get(filename);
    if (!body) {
      debug?.(`get ${filename}: no content`);
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

    const entry: CacheEntry = { ...json, value: streamFromBuffer(json.value) };

    if (this.tagEntries) {
      if (hasExpiredTags(this.tagEntries, entry.tags, entry.timestamp)) {
        debug?.(`get ${filename}: had an expired tag`);
        return undefined;
      }

      if (hasStaledTags(this.tagEntries, entry.tags, entry.timestamp)) {
        debug?.(`get ${filename}: had a staled tag`);
        entry.revalidate = -1;
      }
    }

    debug?.(`get ${filename}: returning cached entry`, entry);
    return entry;
  }

  /**
   * @todo Immediately when a set is made, add the entry to the memory cache, to
   * avoid having to download it and make unnecessary HTTP roundtrips.
   */
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
      const [streamCopy, value] = originalStream.tee();
      entry.value = streamCopy;

      const valueBuffer = await streamToBuffer(value);
      const storedValue = { value: valueBuffer, ...metadata };

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
    debug?.("getExpiration");
    return 0;
  }

  async updateTags(
    tags: string[],
    durations?: { expire?: number },
  ): Promise<void> {
    const now = Date.now();

    const tagsCopy = { ...this.tagEntries };

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

      debug?.(`updateTags (${tag})`, { durations, newEntry });
      tagsCopy[tag] = newEntry;
    }

    await this.tags.putTags(this.options.name, tagsCopy);
  }

  // Util methods

  keyToFilename(cacheKey: string) {
    const keyHash = createHash("md5").update(cacheKey).digest("hex");
    let filename = `${keyHash}.json`;

    if (this.options.compress) filename += ".br";

    return filename;
  }
}
