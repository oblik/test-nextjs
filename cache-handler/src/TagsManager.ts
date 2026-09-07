import type { HandlerStorage } from "./storage/types";

export interface TagsManifest {
  [handlerName: string]: {
    [tagName: string]: Readonly<{
      expired?: number;
      staled?: number;
    }>;
  };
}

export class TagsManager {
  protected manifest?: Readonly<TagsManifest>;
  protected readPromise?: Promise<TagsManifest | undefined>;

  constructor(protected storage: HandlerStorage) {}

  async getTags(handlerName: string) {
    const manifest = await this.readManifest();
    return manifest?.[handlerName];
  }

  async putTags(handlerName: string, tags: TagsManifest[string]) {
    return this.writeManifest({ ...this.manifest, [handlerName]: tags });
  }

  /**
   * @todo Add short in-memory caching of e.g. 500ms
   */
  protected async readManifest() {
    if (this.readPromise) return this.readPromise;

    this.readPromise = this.fetchManifest();
    this.manifest = await this.readPromise;
    this.readPromise = undefined;
    return this.manifest;
  }

  /**
   * @todo Add cleanup of tags older than X hours/days, to optimize space
   */
  protected async writeManifest(tags: TagsManifest) {
    const json = JSON.stringify(tags);
    const body = Buffer.from(json, "utf-8");
    await this.storage.put("tags-manifest.json", body);
  }

  /**
   * @todo Add Brotli compression here as well?
   * @todo Add ETag checking?
   */
  protected async fetchManifest(): Promise<TagsManifest | undefined> {
    const body = await this.storage.get("tags-manifest.json");
    if (!body) return;

    const jsonString = body.toString("utf-8");
    return JSON.parse(jsonString);
  }
}
