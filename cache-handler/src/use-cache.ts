import type { CacheHandler } from "next/dist/server/lib/cache-handlers/types";

// import { TagsHandler } from "./TagsHandler";

const tags = {};

export function createUseCacheHandler(): CacheHandler {
  // const handler = new TagsHandler()
  return {
    async refreshTags() {
      console.log("refreshing tags");
      return;
    },
    async get(cacheKey, softTags) {
      console.log("get");
      return undefined;
    },
    async set(cacheKey, pendingEntry) {
      console.log("set", cacheKey);
    },
    async getExpiration(tags) {
      console.log("getExpiration");
      return 0;
    },
    async updateTags(tags, durations) {
      console.log(tags, durations);
    },
  };
}
