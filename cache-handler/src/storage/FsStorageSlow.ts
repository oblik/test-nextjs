import { createLogger } from "../createLogger";
import { FsStorage } from "./fs";

export class FsStorageSlow extends FsStorage {
  protected log = createLogger("FsStorageSlow");

  async get(key: string) {
    return this.delay(() => super.get(key));
  }

  async put(key: string, body: Buffer) {
    return this.delay(() => super.put(key, body));
  }

  protected async delay<T>(cb: () => T): Promise<T> {
    const result = await cb();

    const time = Math.round(150 + Math.random() * 150);
    await new Promise((r) => setTimeout(r, time));
    this.log?.(`waited ${time}ms`);

    return result;
  }
}
