// Tests for the firmware store (store.js): which adapter and branch the
// environment selects, and that the local adapter honours the same contract
// the GitHub one does — the contract channels.seam.test.mjs relies on.
//
// Runs under vitest (`npm test`).

import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  blobSha,
  branchFor,
  localStore,
  StoreConfigError,
  storeFor,
  storeKindFor,
} from "./store.js";

describe("branchFor", () => {
  test("bare environment writes to main, as before this module", () => {
    expect(branchFor({})).toBe("main");
  });
  test("a deployment writes to the branch it was built from", () => {
    expect(branchFor({ VERCEL_GIT_COMMIT_REF: "staging" })).toBe("staging");
  });
  test("GITHUB_BRANCH overrides the deployment's branch", () => {
    expect(
      branchFor({ VERCEL_GIT_COMMIT_REF: "staging", GITHUB_BRANCH: "main" }),
    ).toBe("main");
  });
});

describe("storeKindFor", () => {
  test("deployed environments use GitHub", () => {
    expect(storeKindFor({ VERCEL_ENV: "production" })).toBe("github");
    expect(storeKindFor({ VERCEL_ENV: "preview" })).toBe("github");
  });
  test("an absent VERCEL_ENV is GitHub, never the read-only filesystem", () => {
    expect(storeKindFor({})).toBe("github");
  });
  test("npm run dev:full uses the working tree", () => {
    expect(storeKindFor({ FIRMWARE_STORE: "local" })).toBe("local");
    expect(storeKindFor({ VERCEL_ENV: "development" })).toBe("local");
  });
  test("FIRMWARE_STORE forces either adapter", () => {
    expect(storeKindFor({ VERCEL_ENV: "development", FIRMWARE_STORE: "github" })).toBe("github");
    expect(storeKindFor({ VERCEL_ENV: "production", FIRMWARE_STORE: "local" })).toBe("local");
  });
  test("GitHub without credentials is a config error, not a crash later", () => {
    expect(() => storeFor({ VERCEL_ENV: "production" })).toThrow(StoreConfigError);
  });
});

describe("localStore", () => {
  let root;
  let store;
  const b64 = (s) => Buffer.from(s).toString("base64");

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "fw-store-"));
    store = localStore({ FIRMWARE_ROOT: root });
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  test("reports itself as local with no history url", () => {
    expect(store.kind).toBe("local");
    expect(store.historyUrl).toBeNull();
  });

  test("get returns null for a missing file, so readManifest can fall back", async () => {
    expect(await store.get("public/nightly/firmware/firmwares.json")).toBeNull();
  });

  test("put creates nested directories and get reads it back", async () => {
    await store.put("public/nightly/firmware/fw.hex", b64(":00000001FF\n"), "add");
    const file = await store.get("public/nightly/firmware/fw.hex");
    expect(Buffer.from(file.content, "base64").toString()).toBe(":00000001FF\n");
    expect(file.size).toBe(12);
    expect(await readFile(path.join(root, "public/nightly/firmware/fw.hex"), "utf8")).toBe(":00000001FF\n");
  });

  test("sha is git's own blob hash, so it matches what GitHub reports", async () => {
    const bytes = Buffer.from("[]\n");
    await store.put("x.json", bytes.toString("base64"), "add");
    const gitSha = execFileSync("git", ["hash-object", "--stdin"], { input: bytes })
      .toString()
      .trim();
    expect(blobSha(bytes)).toBe(gitSha);
    expect((await store.get("x.json")).sha).toBe(gitSha);
  });

  test("overwriting requires the current sha, and a stale one is a 409", async () => {
    await store.put("x.json", b64("a"), "add");
    const { sha } = await store.get("x.json");
    await expect(store.put("x.json", b64("b"), "clobber")).rejects.toMatchObject({ status: 409 });
    await expect(store.put("x.json", b64("b"), "stale", "0".repeat(40))).rejects.toMatchObject({ status: 409 });
    await store.put("x.json", b64("b"), "ok", sha);
    expect(Buffer.from((await store.get("x.json")).content, "base64").toString()).toBe("b");
  });

  test("creating a file with a sha is rejected, like GitHub does", async () => {
    await expect(store.put("new.json", b64("a"), "add", "0".repeat(40))).rejects.toMatchObject({ status: 409 });
  });

  test("del requires the current sha and removes the file", async () => {
    await store.put("x.json", b64("a"), "add");
    const { sha } = await store.get("x.json");
    await expect(store.del("x.json", "0".repeat(40), "rm")).rejects.toMatchObject({ status: 409 });
    await store.del("x.json", sha, "rm");
    expect(await store.get("x.json")).toBeNull();
  });

  test("refuses paths that escape the firmware root", async () => {
    await writeFile(path.join(root, "inside.txt"), "x");
    await expect(store.get("../outside.txt")).rejects.toThrow(/escapes/);
    await expect(store.put("../outside.txt", b64("a"), "add")).rejects.toThrow(/escapes/);
  });

  test("lastCommitDate is a no-op locally", async () => {
    expect(await store.lastCommitDate("anything")).toBeNull();
  });
});
