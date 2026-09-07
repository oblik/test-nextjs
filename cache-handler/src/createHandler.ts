import fs from "node:fs";
import path from "node:path";
import { FsStorage } from "./storage/fs";
import type { HandlerStorage } from "./storage/types";
import { TagsManager } from "./TagsManager";
import type { Handler } from "./use-cache";

let root: string;
let buildId: string;
let storage: HandlerStorage;
let tags: TagsManager;

export function createHandler(
  HandlerClass: typeof Handler,
  options: Handler["options"],
): Handler | undefined {
  // Next initializes during build, where it makes no sense to create handlers,
  // since there's no `BUILD_ID` file and no traffic to serve.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!root) root = path.join(process.cwd(), ".next");

  if (!buildId) {
    const buildIdPath = path.join(root, "BUILD_ID");
    buildId = fs.readFileSync(buildIdPath, "utf8");

    if (!buildId) throw new Error("Build ID missing");
  }

  if (!storage) storage = new FsStorage(path.join(root, "cache/cache-handler"));

  if (!tags) tags = new TagsManager(storage);

  return new HandlerClass({ buildId, storage, tags, options });
}
