import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { createLogger, delay } from "./debug";
import type { HandlerStorage } from "./types";
import { isErrno } from "./utils/isErrno";

const TMP_SUFFIX = ".tmp";

/**
 * Filesystem implementation that should mimic the behaviors of S3 but locally,
 * so that caching can work in development mode.
 */
export class FsStorage implements HandlerStorage {
  protected log = createLogger("FsStorage");

  constructor(protected root: string) {}

  /**
   * Resolves key segments to an absolute path, refusing anything that would
   * escape the storage root (e.g. via `..`).
   */
  pathFor(segments: string[]): string {
    const result = join(this.root, ...segments);
    if (result !== this.root && !result.startsWith(this.root + sep)) {
      throw new Error(`Key escapes storage root: ${segments.join("/")}`);
    }
    return result;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const path = this.pathFor(key.split("/"));
      this.log?.(`reading ${path}`);
      await delay?.(150, 50, this.log);
      return await readFile(path);
    } catch (error) {
      if (isErrno(error, "ENOENT")) return null;
      throw error;
    }
  }

  /**
   * Writes to a temporary file first and then renames it, so a concurrent
   * `get` never observes a partially written entry.
   */
  async put(key: string, body: Buffer): Promise<void> {
    const filepath = this.pathFor(key.split("/"));
    const tmp = `${filepath}.${randomUUID()}${TMP_SUFFIX}`;

    await mkdir(dirname(filepath), { recursive: true });

    try {
      this.log?.(`writing ${filepath}`);
      await delay?.(200, 100, this.log);
      await writeFile(tmp, body);
      await rename(tmp, filepath);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
  }
}
