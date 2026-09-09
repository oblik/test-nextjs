// @vitest-environment node
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FsStorage } from "./FsStorage";

let root: string;
let storage: FsStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cache-handler-fs-"));
  storage = new FsStorage(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("get/put", () => {
  it("round-trips a nested key, creating parent directories", async () => {
    const key = "build/x/page/123/us/en/banner_ids=&eea=false.json";
    await storage.put(key, Buffer.from('{"a":1}'));
    expect(await storage.get(key)).toEqual(Buffer.from('{"a":1}'));
  });

  it("returns null for a missing key", async () => {
    expect(await storage.get("build/x/missing.json")).toBeNull();
  });

  it("overwrites an existing key without leaving temp files", async () => {
    const key = "build/x/page/1.json";
    await storage.put(key, Buffer.from("first"));
    await storage.put(key, Buffer.from("second"));
    expect(await storage.get(key)).toEqual(Buffer.from("second"));
    expect(await readdir(join(root, "build/x/page"))).toEqual(["1.json"]);
  });

  it("survives concurrent writes to the same key", async () => {
    const key = "build/x/page/1.json";
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        storage.put(key, Buffer.from(JSON.stringify({ i }))),
      ),
    );
    const body = await storage.get(key);
    expect(body).not.toBeNull();
    const { i } = JSON.parse(body!.toString("utf-8"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(20);
  });

  it("refuses keys that escape the root", async () => {
    await expect(storage.get("../outside.json")).rejects.toThrow(/escapes/);
  });
});
