// Tests for the manifest/binary seam in channels.js: readManifest,
// writeManifests, and moveBinary. These functions take injected get/put/del
// callbacks, so the whole seam runs against an in-memory fake of the GitHub
// Contents API — no network, no repo.
//
// The properties under test are the ones the comments in channels.js promise:
//   - the admin manifest wins whenever the FILE EXISTS, empty or not
//   - the public manifest is written before the admin one
//   - shas from the read are asserted on the write, so a concurrent change
//     409s instead of being clobbered
//   - moveBinary never deletes the only copy: destination is written and
//     sha-verified before the source is removed
//
// Runs under vitest (`npm test`). channels.test.mjs next door is the separate
// bare-node registry sync check.

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import {
  ADMIN_MANIFEST,
  moveBinary,
  PUBLIC_MANIFEST,
  readManifest,
  writeManifests,
} from "./channels.js";

// ---------------------------------------------------------------------------
// Fake GitHub contents store. Shas are content-addressed like git blob shas,
// which is what moveBinary's "same sha means same bytes" comparison relies on.

const shaOf = (contentBase64) =>
  createHash("sha1").update(contentBase64).digest("hex");

const makeStore = () => {
  const files = new Map();
  const log = [];

  const get = async (path) => {
    const f = files.get(path);
    if (!f) return null;
    return { path, content: f.content, sha: f.sha, size: f.size };
  };

  const put = async (path, contentBase64, message, sha) => {
    const existing = files.get(path);
    // GitHub's rules: writing over an existing file requires its current sha;
    // creating a new file requires the sha be omitted.
    if (existing && sha !== existing.sha) {
      const e = new Error(`PUT ${path} -> 409: sha mismatch`);
      e.status = 409;
      throw e;
    }
    if (!existing && sha !== undefined) {
      const e = new Error(`PUT ${path} -> 422: sha given for new file`);
      e.status = 422;
      throw e;
    }
    files.set(path, {
      content: contentBase64,
      sha: shaOf(contentBase64),
      size: Buffer.from(contentBase64, "base64").length,
    });
    log.push({ op: "put", path, message });
  };

  const del = async (path, sha, message) => {
    const existing = files.get(path);
    if (!existing || sha !== existing.sha) {
      const e = new Error(`DELETE ${path} -> 409: sha mismatch`);
      e.status = 409;
      throw e;
    }
    files.delete(path);
    log.push({ op: "del", path, message });
  };

  const seed = (path, value) => {
    const content = Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ).toString("base64");
    files.set(path, {
      content,
      sha: shaOf(content),
      size: Buffer.from(content, "base64").length,
    });
  };

  return { files, log, get, put, del, seed };
};

const decode = (store, path) =>
  JSON.parse(Buffer.from(store.files.get(path).content, "base64").toString());

const PUBLIC_PATH = `public/nightly/firmware/${PUBLIC_MANIFEST}`;
const ADMIN_PATH = `archive/nightly/firmware/${ADMIN_MANIFEST}`;

const entry = (id, overrides = {}) => ({
  id,
  name: `FW ${id}`,
  filepath: `./fw-${id}.hex`,
  active: true,
  ...overrides,
});

// ---------------------------------------------------------------------------

describe("readManifest", () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  test("admin manifest wins when both exist", async () => {
    store.seed(ADMIN_PATH, [entry(0), entry(1, { active: false })]);
    store.seed(PUBLIC_PATH, [entry(0)]);

    const { entries } = await readManifest(store.get, "nightly");
    expect(entries).toHaveLength(2);
    expect(entries[1].active).toBe(false);
  });

  test("an EMPTY admin manifest still wins over a stale public copy", async () => {
    // The exact case the old three-call-site rule got wrong: unlisting the
    // last firmware leaves a legitimately-empty admin manifest, and the stale
    // public copy must not resurrect the entry.
    store.seed(ADMIN_PATH, []);
    store.seed(PUBLIC_PATH, [entry(0)]);

    const { entries } = await readManifest(store.get, "nightly");
    expect(entries).toEqual([]);
  });

  test("falls back to the public manifest only when the admin one is absent", async () => {
    store.seed(PUBLIC_PATH, [entry(0)]);

    const { entries } = await readManifest(store.get, "nightly");
    expect(entries).toHaveLength(1);
  });

  test("returns empty entries and null file when neither manifest exists", async () => {
    const { file, entries } = await readManifest(store.get, "nightly");
    expect(file).toBeNull();
    expect(entries).toEqual([]);
  });

  test("returns both shas keyed by path, undefined for missing files", async () => {
    store.seed(PUBLIC_PATH, [entry(0)]);

    const { shas } = await readManifest(store.get, "nightly");
    expect(shas[PUBLIC_PATH]).toBe(store.files.get(PUBLIC_PATH).sha);
    expect(shas[ADMIN_PATH]).toBeUndefined();
  });
});

describe("writeManifests", () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  const write = (entries, shas = {}) =>
    writeManifests({
      put: store.put,
      target: "nightly",
      entries,
      message: "admin: test write",
      shas,
    });

  test("writes the public manifest FIRST, then the admin one", async () => {
    // The ordering is the safety property: a failed admin write leaves a
    // stale dashboard row; the reverse ordering would leave the public page
    // advertising a firmware whose binary is about to be archived.
    await write([entry(0)]);

    expect(store.log.map((c) => c.path)).toEqual([PUBLIC_PATH, ADMIN_PATH]);
    expect(store.log[0].message).toBe("admin: test write (public manifest)");
    expect(store.log[1].message).toBe("admin: test write (admin manifest)");
  });

  test("public copy omits unlisted entries, admin copy keeps everything", async () => {
    await write([entry(0), entry(1, { active: false }), entry(2)]);

    expect(decode(store, PUBLIC_PATH).map((e) => e.id)).toEqual([0, 2]);
    expect(decode(store, ADMIN_PATH).map((e) => e.id)).toEqual([0, 1, 2]);
  });

  test("internal notes never reach the public manifest", async () => {
    // The whole point of the field: "just for us" lines are stored with the
    // firmware but must not be served. The admin copy keeps them.
    await write([
      entry(0, {
        description: "Bypass mute time much quicker",
        internalNotes: "Secret aux jack hardware config midi message added",
      }),
    ]);

    const pub = decode(store, PUBLIC_PATH)[0];
    expect(pub.internalNotes).toBeUndefined();
    expect(pub.description).toBe("Bypass mute time much quicker");
    expect(decode(store, ADMIN_PATH)[0].internalNotes).toBe(
      "Secret aux jack hardware config midi message added",
    );
  });

  test("stripping internal notes does not mutate the caller's entries", async () => {
    const entries = [entry(0, { internalNotes: "keep me" })];
    await write(entries);
    expect(entries[0].internalNotes).toBe("keep me");
  });

  test("entries predating the active field stay publicly visible", async () => {
    const legacy = entry(0);
    delete legacy.active;
    await write([legacy]);

    expect(decode(store, PUBLIC_PATH)).toHaveLength(1);
  });

  test("a concurrent change rejects with 409 instead of being clobbered", async () => {
    store.seed(PUBLIC_PATH, [entry(0)]);
    store.seed(ADMIN_PATH, [entry(0)]);
    const { entries, shas } = await readManifest(store.get, "nightly");

    // Another admin's write lands between our read and our write.
    store.seed(PUBLIC_PATH, [entry(0), entry(99)]);

    await expect(write([...entries, entry(1)], shas)).rejects.toThrow("409");
    // The failed public write also stopped the admin write: the intruding
    // entry 99 is still there and entry 1 landed nowhere.
    expect(decode(store, PUBLIC_PATH).map((e) => e.id)).toEqual([0, 99]);
    expect(decode(store, ADMIN_PATH).map((e) => e.id)).toEqual([0]);
  });

  test("round-trips through readManifest with the returned shas", async () => {
    store.seed(PUBLIC_PATH, [entry(0)]);
    store.seed(ADMIN_PATH, [entry(0)]);

    const first = await readManifest(store.get, "nightly");
    await write([...first.entries, entry(1)], first.shas);

    const second = await readManifest(store.get, "nightly");
    expect(second.entries.map((e) => e.id)).toEqual([0, 1]);
  });
});

describe("moveBinary", () => {
  const FROM = "public/nightly/firmware/fw.hex";
  const TO = "archive/nightly/firmware/fw.hex";
  const BYTES = Buffer.from("firmware bytes").toString("base64");

  let store;
  beforeEach(() => {
    store = makeStore();
  });

  const move = () =>
    moveBinary({
      get: store.get,
      put: store.put,
      del: store.del,
      from: FROM,
      to: TO,
      message: "admin: archive fw.hex",
    });

  test("copies, sha-verifies, then deletes the source", async () => {
    store.seed(FROM, "firmware bytes");
    const sourceSha = store.files.get(FROM).sha;

    await expect(move()).resolves.toBe(true);
    expect(store.files.has(FROM)).toBe(false);
    expect(store.files.get(TO).sha).toBe(sourceSha);
    // Copy-then-delete, with each commit naming its own step.
    expect(store.log.map((c) => [c.op, c.message])).toEqual([
      ["put", "admin: archive fw.hex (copy)"],
      ["del", "admin: archive fw.hex (remove old copy)"],
    ]);
  });

  test("returns false and writes nothing when the source is missing", async () => {
    await expect(move()).resolves.toBe(false);
    expect(store.log).toEqual([]);
  });

  test("strips newlines the Contents API inserts into base64", async () => {
    // GitHub wraps base64 content in newlines on GET; a PUT of that raw
    // string would be rejected. The store's sha is content-addressed, so the
    // move only verifies if the newline-stripped bytes hash the same.
    const wrapped = BYTES.match(/.{1,8}/g).join("\n");
    store.files.set(FROM, {
      content: wrapped,
      // sha reflects the CLEAN content, as git's blob sha does.
      sha: shaOf(BYTES),
      size: Buffer.from(BYTES, "base64").length,
    });

    await expect(move()).resolves.toBe(true);
    expect(store.files.get(TO).content).toBe(BYTES);
  });

  test("refuses to overwrite a different file already at the destination", async () => {
    store.seed(FROM, "firmware bytes");
    store.seed(TO, "some other file");

    await expect(move()).rejects.toThrow("already exists with different content");
    // Neither file was touched: the source survives, the foreign file too.
    expect(store.files.has(FROM)).toBe(true);
    expect(decodeText(store, TO)).toBe("some other file");
    expect(store.log).toEqual([]);
  });

  test("resumes an interrupted move: identical copy at destination, source still deleted", async () => {
    store.seed(FROM, "firmware bytes");
    store.seed(TO, "firmware bytes");

    await expect(move()).resolves.toBe(true);
    expect(store.files.has(FROM)).toBe(false);
    // No second copy commit — just the delete.
    expect(store.log.map((c) => c.op)).toEqual(["del"]);
  });

  test("fails loudly on files the Contents API will not inline", async () => {
    store.files.set(FROM, {
      content: "",
      sha: "whatever",
      size: 2 * 1024 * 1024,
    });

    await expect(move()).rejects.toThrow("too large to move");
    expect(store.files.has(FROM)).toBe(true);
    expect(store.log).toEqual([]);
  });

  test("keeps the source when the copy does not land intact", async () => {
    store.seed(FROM, "firmware bytes");
    // A put that silently corrupts the write — the re-read sha check is the
    // only thing standing between this and deleting the good copy.
    const corruptPut = async (path, _content, message) => {
      await store.put(path, Buffer.from("garbage").toString("base64"), message);
    };

    await expect(
      moveBinary({
        get: store.get,
        put: corruptPut,
        del: store.del,
        from: FROM,
        to: TO,
        message: "admin: archive fw.hex",
      }),
    ).rejects.toThrow("did not land intact");
    expect(store.files.has(FROM)).toBe(true);
    expect(store.log.map((c) => c.op)).toEqual(["put"]);
  });
});

const decodeText = (store, path) =>
  Buffer.from(store.files.get(path).content, "base64").toString();
