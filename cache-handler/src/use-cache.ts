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
import fs from "node:fs";
import path from "node:path";
import { decode, encode } from "./compress";
import { replaceBuffers, reviveBuffers } from "./reviveBuffers";
import { FsStorage } from "./storage/fs";
import type { Storage } from "./storage/types";

const debug = process.env.NEXT_CACHE_S3_DEBUG
  ? console.debug.bind(console, "[next-cache-s3]:")
  : undefined;

export class Handler implements CacheHandler {
  buildId: string;
  storage: Storage;
  options: {
    compress: boolean;
    base64: boolean;
  };

  /**
   * Inspired by the example custom cache handler implementation by Next.
   * @see https://github.com/vercel/next.js/blob/6ef6e29db5ec78704af1ea05a16b233bb7faac7c/packages/next/src/server/lib/cache-handlers/default.ts#L68
   */
  pendingSets = new Map<string, Promise<CacheEntry | undefined>>();

  constructor({
    buildId,
    storage,
    options,
  }: {
    buildId: string;
    storage: Storage;
    options: Handler["options"];
  }) {
    this.buildId = buildId;
    this.storage = storage;
    this.options = options;
  }

  async refreshTags() {
    debug?.("refreshing tags");
    return;
  }

  async get(
    cacheKey: string,
    softTags: string[],
  ): Promise<undefined | CacheEntry> {
    const filename = this.keyToFilename(cacheKey);

    const pendingPromise = this.pendingSets.get(filename);
    if (pendingPromise) return pendingPromise;

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

    const result = { ...json, value: streamFromBuffer(json.value) };
    debug?.(`get ${filename}: returning cached value`);
    return result;
  }

  async set(
    cacheKey: string,
    pendingEntry: Promise<CacheEntry>,
  ): Promise<void> {
    const filename = this.keyToFilename(cacheKey);

    let resolve: (value?: CacheEntry) => void;
    const pendingPromise = new Promise<CacheEntry | undefined>(
      (r) => (resolve = r),
    );
    this.pendingSets.set(filename, pendingPromise);

    let entry: CacheEntry | undefined;

    try {
      entry = await pendingEntry;

      /**
       * Like the Next.js implementation.
       * @see https://github.com/vercel/next.js/blob/6ef6e29db5ec78704af1ea05a16b233bb7faac7c/packages/next/src/server/lib/cache-handlers/default.ts#L177
       */
      const { value, ...metadata } = entry;
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
      resolve!(entry);
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
    debug?.("updateTags", tags, durations);
  }

  // Util methods

  keyToFilename(cacheKey: string) {
    const keyHash = createHash("md5").update(cacheKey).digest("hex");
    let filename = `${keyHash}.json`;

    if (this.options.compress) filename += ".br";

    return filename;
  }
}

let root: string | undefined;
let buildId: string | undefined;

export function createHandler(
  HandlerClass: typeof Handler,
  options: Handler["options"],
): Handler | undefined {
  // Next initializes during build, where it makes no sense to create handlers,
  // since there's no `BUILD_ID` file and no traffic to serve.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!root) {
    root = path.join(process.cwd(), ".next");

    const buildIdPath = path.join(root, "BUILD_ID");
    buildId = fs.readFileSync(buildIdPath, "utf8");
  }

  if (!buildId) throw new Error("Build ID missing");

  const storage = new FsStorage(path.join(root, "cache/cache-handler"));

  return new HandlerClass({ buildId, storage, options });
}
