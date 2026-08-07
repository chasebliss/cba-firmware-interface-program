// The channel registry, server side. Mirrors CHANNELS in
// src/lib/admin-firmware.ts — that copy is the one the browser bundle uses,
// this one is what the serverless functions import. They're duplicated because
// api/*.js runs on Vercel's Node runtime with no TypeScript transpile step, so
// it can't import from src/.
//
// Keep the two in sync. If they drift, the symptom is a target the UI offers
// but the API rejects with a 400 (or worse, a directory mismatch), so add
// channels to both or neither.

// `dir` is served: everything under public/ is copied into dist/ by the Vite
// build and handed out statically, with no way to gate an individual file.
// `archiveDir` sits OUTSIDE public/, so files there are in the repo but are
// not built and not reachable by URL. Unlisting moves the binary from one to
// the other, which is what makes "unlisted" mean "not downloadable" rather
// than merely "not advertised".
export const CHANNELS = [
  {
    id: "production",
    label: "Production",
    dir: "public/firmware",
    archiveDir: "archive/firmware",
  },
  {
    id: "beta",
    label: "Beta",
    dir: "public/beta/firmware",
    archiveDir: "archive/beta/firmware",
  },
  {
    id: "nightly",
    label: "Nightly",
    dir: "public/nightly/firmware",
    archiveDir: "archive/nightly/firmware",
  },
];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id);

export function isValidTarget(target) {
  return CHANNELS.some((c) => c.id === target);
}

// Resolves a channel record. Throws on an unknown target rather than
// defaulting — callers validate first, so reaching here with a bad target is a
// bug, and silently resolving to public/firmware is the exact failure mode this
// registry exists to prevent.
export function channelFor(target) {
  const channel = CHANNELS.find((c) => c.id === target);
  if (channel) return channel;

  // Passing a directory instead of a channel id is the easy mistake here —
  // both are strings, so nothing catches it until this throw, and the bare
  // "Unknown firmware target: public/firmware" reads like corrupt data rather
  // than a wrong argument. Name the actual problem.
  const byDir = CHANNELS.find(
    (c) => c.dir === target || c.archiveDir === target,
  );
  if (byDir) {
    throw new Error(
      `channelFor() takes a channel id, not a directory. Got "${target}" — did you mean "${byDir.id}"?`,
    );
  }
  throw new Error(
    `Unknown firmware target: ${target}. Expected one of: ${CHANNEL_IDS.join(", ")}.`,
  );
}

/** Served directory — files here are built into dist/ and publicly fetchable. */
export const dirFor = (target) => channelFor(target).dir;

/** Unserved directory — files here are in the repo but have no URL. */
export const archiveDirFor = (target) => channelFor(target).archiveDir;

export const TARGET_ERROR = `target must be one of: ${CHANNEL_IDS.join(", ")}`;

// Two manifests per channel:
//
//   <dir>/firmwares.json                — what the public pages fetch. Listed
//                                         entries only. Served.
//   <archiveDir>/firmwares.admin.json   — the full record, including unlisted
//                                         entries. NOT served.
//
// The admin copy lives under archiveDir precisely because anything under
// public/ is built and handed out: keeping it beside the public manifest would
// publish the list of unlisted firmware, defeating the split. list-firmwares
// reads it through the GitHub API, which doesn't care that it isn't served.
//
// The split exists because unlisting used to be cosmetic: the entry stayed in
// the one public manifest with `active: false` and the browser filtered it out,
// so anyone reading the JSON directly saw every build you'd ever pulled. Now
// unlisting removes it from the file the public actually downloads.
//
// Unlisting also MOVES the binary out of the served directory into archiveDir
// (see moveBinary), so the direct URL stops working too. The file is kept in
// the repo, so listing it again restores it; delete is what removes it for good.
export const PUBLIC_MANIFEST = "firmwares.json";
export const ADMIN_MANIFEST = "firmwares.admin.json";

// Which manifest to read, in one place.
//
// This decision was previously made at three call sites with two different
// rules: `list-firmwares` fell back on an EMPTY admin manifest, while
// `update`/`upload` fell back only on a MISSING one. Unlisting the last
// firmware in a channel leaves a legitimately-empty admin manifest, so the
// two rules disagreed exactly then — the dashboard resurrected the stale
// public copy while the write path correctly saw nothing.
//
// The rule: the admin manifest wins whenever the FILE EXISTS, empty or not.
// Only a genuinely absent admin manifest (a channel written before the split)
// falls back to the public copy.
//
// `get` returns the raw Contents API record, or null on 404. `target` is the
// channel id, since the two manifests live in different directories.
//
// Returns the shas of BOTH manifests so writeManifests can reuse them instead
// of re-fetching. That saves two round-trips per save and — more importantly —
// closes the window where another admin's write could land between the read
// and the write and be silently clobbered. Passing a stale sha makes GitHub
// reject with a 409 instead.
export async function readManifest(get, target) {
  const publicPath = `${dirFor(target)}/${PUBLIC_MANIFEST}`;
  const adminPath = `${archiveDirFor(target)}/${ADMIN_MANIFEST}`;

  const [adminFile, publicFile] = await Promise.all([
    get(adminPath),
    get(publicPath),
  ]);

  const file = adminFile ?? publicFile;
  const shas = { [adminPath]: adminFile?.sha, [publicPath]: publicFile?.sha };
  if (!file) return { file: null, entries: [], shas };

  const entries = JSON.parse(
    Buffer.from(file.content, "base64").toString("utf8"),
  );
  return { file, entries, shas };
}

// Entries the public manifest should contain. `active !== false` matches the
// old client-side filter, so entries predating the field stay visible.
export function publicEntries(entries) {
  return entries.filter((e) => e.active !== false);
}

// Writes both manifests for a channel.
//
// The public manifest goes FIRST. There is no transaction across two GitHub
// commits, so one of them can land alone, and the orderings differ in what
// that leaves behind:
//
//   public first  — a failed admin write leaves the admin dashboard showing a
//                   stale row. Cosmetic, admin-only, self-heals on next write.
//   admin first   — a failed public write leaves the public page offering a
//                   firmware whose binary has already been archived, so users
//                   get a 404 from the picker.
//
// An earlier version had this backwards and claimed the ordering was safe; it
// only reasoned about not exposing a just-unlisted entry, and missed that the
// binary move happens around this call. Callers move the binary AFTER this
// returns on unlist, so the public manifest never advertises a file that has
// already gone.
//
// `put` is the caller's githubPutFile. `shas` comes from the readManifest()
// that produced `entries` — passing those through means the write asserts it's
// updating the same revision it read, so a concurrent change 409s rather than
// being silently overwritten. An undefined sha is correct for a file that
// doesn't exist yet (GitHub requires it omitted, not empty), which is the
// normal case for a channel's first admin manifest.
export async function writeManifests({ put, target, entries, message, shas = {} }) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value, null, 2) + "\n").toString("base64");

  const write = async (path, value, msg) => {
    await put(path, encode(value), msg, shas[path]);
  };

  await write(
    `${dirFor(target)}/${PUBLIC_MANIFEST}`,
    publicEntries(entries),
    message,
  );
  await write(
    `${archiveDirFor(target)}/${ADMIN_MANIFEST}`,
    entries,
    `${message} (admin)`,
  );
}

// Moves a firmware binary between the served directory and the archive.
// GitHub's Contents API has no move, so this is copy-then-delete.
//
// Ordering is chosen so a mid-sequence failure never destroys the only copy:
// write the destination first, verify it landed, then delete the source. A
// failure between the two leaves the file in both places — recoverable and
// visible — rather than in neither.
//
// Returns true if a move happened, false if there was nothing at `from`
// (already moved, or a manifest entry whose binary is missing).
export async function moveBinary({ get, put, del, from, to, message }) {
  const source = await get(from);
  if (!source) return false;

  // GitHub's Contents API stops inlining `content` above 1MB — it returns the
  // metadata with an empty content field instead. Copying that would write a
  // zero-byte file and then delete the real one, so fail loudly instead. All
  // current firmware is well under this; the upload cap is 10MB, so a future
  // file could hit it.
  if (!source.content) {
    throw new Error(
      `${from} is too large to move via the Contents API (${source.size} bytes). Move it manually in git.`,
    );
  }

  // The source is only ever deleted once a byte-identical copy is confirmed at
  // the destination. Checking mere EXISTENCE is not enough: a truncated write
  // from an earlier partial run, or an unrelated file that happens to share the
  // name, would satisfy it and the real firmware would be destroyed with only
  // git history to recover from.
  //
  // Git blob shas are content-addressed, so comparing them is an exact
  // content comparison without re-downloading anything.
  const content = source.content.replace(/\n/g, "");
  const existingTarget = await get(to);

  if (!existingTarget) {
    await put(to, content, message);
  } else if (existingTarget.sha !== source.sha) {
    // Something else is already sitting at the destination. Refuse rather than
    // overwrite it or delete the source — both destroy a file someone may want.
    throw new Error(
      `${to} already exists with different content (${existingTarget.sha} vs ${source.sha}). ` +
        `Resolve it in git before moving; ${from} left intact.`,
    );
  }

  // Re-read and compare against the source sha. `landed` being truthy only
  // proves a file is there, not that it's the right one — an interrupted or
  // partial write would still pass an existence check.
  const landed = await get(to);
  if (!landed || landed.sha !== source.sha) {
    throw new Error(
      `Copy to ${to} did not land intact (expected ${source.sha}, got ${landed?.sha ?? "nothing"}). ` +
        `${from} left intact.`,
    );
  }

  await del(from, source.sha, message);
  return true;
}
