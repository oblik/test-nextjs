import { createLogger } from "./debug";
import type { HandlerStorage } from "./types";

export interface TagsManifest {
  [tagName: string]: Readonly<{
    /** Timestamp at which the resource tagged with this tag becomes expired. */
    expiresAt?: number;

    /** Timestamp at which the resource tagged with this tag becomes stale. */
    stalesAt?: number;
  }>;
}

export class TagsManager {
  protected log = createLogger("TagsManager");

  protected manifest?: Readonly<TagsManifest>;
  protected readPromise?: Promise<TagsManifest | undefined>;
  protected loadedAt?: number;

  constructor(
    protected storage: HandlerStorage,
    protected staleMs: number,
    protected expireMs: number,
    /**
     * Time a tag is allowed to stay in the manifest after both its `expiresAt`
     * and `stalesAt` have passed. Tags that have stayed for e.g. a few hours
     * have probably triggered every revalidation necessary and can be removed,
     * to reduce the size of the manifest.
     */
    protected evictMs: number,
  ) {}

  async getTags() {
    if (!this.manifest) return this.loadManifest();

    const now = Date.now();

    // Manifest is fresh; directly return it.
    if (now < this.loadedAt! + this.staleMs) {
      this.log?.("returning fresh manifest");
      return this.manifest;
    }

    // Manifest is stale; load it **in the background**.
    if (now < this.loadedAt! + this.expireMs) {
      this.log?.("revalidating stale manifest");
      this.loadManifest();
      return this.manifest;
    }

    // Manifest is expired.
    return this.loadManifest();
  }

  async putTags(tags: TagsManifest) {
    this.updateManifest(tags);
    this.scheduleUpdate();
  }

  protected async loadManifest() {
    if (this.readPromise) return this.readPromise;

    this.readPromise = this.fetchManifest();
    const manifest = await this.readPromise;
    if (manifest) this.updateManifest(manifest);
    this.readPromise = undefined;
    return this.manifest;
  }

  /**
   * @todo Add Brotli compression here as well?
   * @todo Add ETag checking?
   */
  protected async fetchManifest(): Promise<TagsManifest | undefined> {
    this.log?.("fetching manifest");
    const body = await this.storage.get("tags-manifest.json");
    if (!body) return;

    this.loadedAt = Date.now();
    const jsonString = body.toString("utf-8");
    return JSON.parse(jsonString);
  }

  protected async updateManifest(tags: TagsManifest) {
    const now = Date.now();
    const newManifest = Object.assign({}, this.manifest || {}, tags);
    let dirty = false;

    for (const tagName in newManifest) {
      const tag = newManifest[tagName];
      const msSinceStaled = tag.stalesAt ? now - tag.stalesAt : Infinity;
      const msSinceExpired = tag.expiresAt ? now - tag.expiresAt : Infinity;
      if (msSinceStaled >= this.evictMs && msSinceExpired >= this.evictMs) {
        this.log?.(`evicting tag from manifest: ${tagName}`);
        delete newManifest[tagName];
        dirty = true;
      }
    }

    this.manifest = newManifest;
    if (dirty) this.scheduleUpdate();
  }

  /**
   * Prevents performing unnecessary updates by scheduling a single update at
   * the end of the call stack. Otherwise, if you have multiple cache handlers
   * registered, each one will try to update the tags manifest immediately,
   * resulting in one update per handler.
   */
  protected scheduleUpdate() {
    if (this.scheduledTimer) {
      this.log?.("cancelling scheduled update");
      clearTimeout(this.scheduledTimer);
    }

    this.log?.("scheduling update");

    this.scheduledTimer = setTimeout(() => {
      this.scheduledTimer = undefined;

      const json = JSON.stringify(this.manifest);
      const body = Buffer.from(json, "utf-8");

      this.log?.("writing manifest");
      this.storage.put("tags-manifest.json", body);
    }, 0);
  }

  protected scheduledTimer?: NodeJS.Timeout;
}
