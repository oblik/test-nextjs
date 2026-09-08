import { createLogger } from "./debug";
import type { HandlerStorage } from "./storage/types";

export interface TagsManifest {
  [tagName: string]: Readonly<{
    expired?: number;
    staled?: number;
  }>;
}

export class TagsManager {
  protected log = createLogger("TagsManager");

  protected manifest?: Readonly<TagsManifest>;
  protected readPromise?: Promise<TagsManifest | undefined>;
  protected loadedAt?: number;

  constructor(
    protected storage: HandlerStorage,
    protected stale: number,
    protected expire: number,
  ) {}

  async getTags() {
    if (!this.manifest) return this.loadManifest();

    const now = Date.now();

    // Manifest is fresh; directly return it.
    if (now < this.loadedAt! + this.stale) {
      this.log?.("returning fresh manifest");
      return this.manifest;
    }

    // Manifest is stale; load it **in the background**.
    if (now < this.loadedAt! + this.expire) {
      this.log?.("revalidating stale manifest");
      this.loadManifest();
      return this.manifest;
    }

    // Manifest is expired.
    return this.loadManifest();
  }

  /**
   * @todo Add cleanup of tags older than X hours/days, to optimize space
   */
  async putTags(tags: TagsManifest) {
    const json = JSON.stringify(tags);
    const body = Buffer.from(json, "utf-8");
    await this.storage.put("tags-manifest.json", body);
  }

  protected async loadManifest() {
    if (this.readPromise) return this.readPromise;

    this.readPromise = this.fetchManifest();
    this.manifest = await this.readPromise;
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
}
