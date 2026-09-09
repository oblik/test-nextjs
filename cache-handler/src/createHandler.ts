import fs from "node:fs";
import path from "node:path";
import { FsStorage } from "./FsStorage";
import type { Handler } from "./Handler";
import { S3Storage } from "./S3Storage";
import { TagsManager } from "./TagsManager";
import type { HandlerStorage } from "./types";
import { NEXT_CACHE_S3_BUCKET, NEXT_CACHE_S3_REGION } from "./utils/config";

let root: string;
let buildId: string;
let storage: HandlerStorage;
let tagsManager: TagsManager;

/**
 * This factory function is needed because we need to dynamically switch the
 * cache handler storage adapter (S3 or filesystem) depending on whether we're
 * running locally or not.
 */
export function createHandler(
  HandlerClass: typeof Handler,
  options: {
    name: string;
    lruSize: number;
    sticky: boolean;
    compress: boolean;
    base64: boolean;
    tags?: {
      staleMs: number;
      expireMs: number;
    };
  },
): Handler | undefined {
  if (!root) root = path.join(process.cwd(), ".next");

  if (!buildId) {
    if (process.env.__NEXT_DEV_SERVER === "1") {
      buildId = "_dev";
    } else if (process.env.NEXT_PHASE === "phase-production-build") {
      buildId = "_build";
    } else {
      const buildIdPath = path.join(root, "BUILD_ID");
      buildId = fs.readFileSync(buildIdPath, "utf8");

      if (!buildId) throw new Error("Build ID missing");
    }
  }

  if (!storage) {
    if (NEXT_CACHE_S3_BUCKET && NEXT_CACHE_S3_REGION) {
      storage = new S3Storage(NEXT_CACHE_S3_BUCKET, NEXT_CACHE_S3_REGION);
    } else {
      storage = new FsStorage(path.join(root, "cache/cache-handler"));
    }
  }

  if (!tagsManager) {
    tagsManager = new TagsManager(
      storage,
      options.tags?.staleMs ?? 500,
      options.tags?.expireMs ?? 1000,
      10 * 1000,
    );
  }

  return new HandlerClass(buildId, storage, tagsManager, options);
}
