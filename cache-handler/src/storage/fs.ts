import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { isErrno } from "../isErrno";
import type { HandlerStorage } from "./types";

const TMP_SUFFIX = ".tmp";

/**
 * Stores cache entries as files, mapping each `/`-separated object key to a
 * path below `root`. Meant for local debugging, where there's no S3 bucket.
 */
export class FsStorage implements HandlerStorage {
  root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

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
      return await readFile(this.pathFor(key.split("/")));
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
      await writeFile(tmp, body);
      await rename(tmp, filepath);
    } catch (error) {
      await rm(tmp, { force: true });
      // The directory was removed by a concurrent `deletePrefix`, i.e. the
      // entry was invalidated mid-write. The next request re-creates it, which
      // is the same outcome as the equivalent S3 race.
      if (isErrno(error, "ENOENT")) return;
      throw error;
    }
  }

  /**
   * Replicates S3 prefix semantics over the literal key string. Note that the
   * prefix `page/123` matches `page/123.json`, `page/123/...` **and**
   * `page/1234/...`. That over-match is how S3 behaves and is preserved
   * deliberately, so both backends invalidate the same entries.
   */
  async deletePrefix(prefix: string): Promise<string[]> {
    const segments = prefix.split("/");
    const dir = segments.slice(0, -1);
    const base = segments[segments.length - 1];

    // S3 has no keys with empty path segments (`a//b`), so such a prefix
    // matches nothing. Bailing early also prevents `path.join` from collapsing
    // the empty segment and deleting a whole parent directory. An empty prefix
    // would match everything and is refused for the same reason.
    if (dir.some((segment) => !segment)) return [];
    if (!dir.length && !base) return [];

    const dirPath = this.pathFor(dir);

    let entries: Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if (isErrno(error, "ENOENT")) return [];
      throw error;
    }

    const deleted: string[] = [];

    for (const entry of entries) {
      if (!entry.name.startsWith(base)) continue;

      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const files = await readdir(entryPath, {
          recursive: true,
          withFileTypes: true,
        });
        for (const file of files) {
          if (!file.isFile() || file.name.endsWith(TMP_SUFFIX)) continue;
          const path = relative(dirPath, join(file.parentPath, file.name));
          deleted.push([...dir, ...path.split(sep)].join("/"));
        }
      } else if (!entry.name.endsWith(TMP_SUFFIX)) {
        deleted.push([...dir, entry.name].join("/"));
      }

      await rm(entryPath, { recursive: true, force: true });
    }

    return deleted;
  }
}
