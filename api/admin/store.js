// The firmware store: where the admin API reads and writes manifests and
// binaries. One interface, two adapters, chosen from the environment:
//
//   github — production and every Vercel preview. Reads and commits on the
//            branch the DEPLOYMENT WAS BUILT FROM (VERCEL_GIT_COMMIT_REF), so
//            the admin on the staging preview writes to `staging`, Vercel
//            redeploys `staging`, and the preview's public pages catch up.
//            Production is built from `main`, so it writes to `main`. The
//            admin and the public site always describe the same branch.
//
//   local  — `npm run dev:full` (vercel dev with FIRMWARE_STORE=local). Reads
//            and writes the working tree directly. Vite
//            serves public/ from disk, so a save shows on the local /nightly
//            page immediately, and `git diff` is the review step before the
//            change goes anywhere. No token, no network, no commits.
//
// Before this module each endpoint had its own GitHub client hardwired to
// GITHUB_BRANCH || "main", so the admin on a preview (or on localhost) read
// and wrote production's branch while the page beside it served the preview's
// own files. That is the "why can't the admin see what /nightly shows" bug.
//
// The interface is the seam channels.seam.test.mjs exercises with an
// in-memory fake:
//
//   get(path)                          → { path, content, sha, size } | null
//   put(path, contentBase64, message, sha?)
//   del(path, sha, message)
//   lastCommitDate(path)               → ISO string | null
//
// `sha` follows GitHub's rules in both adapters: writing over an existing
// file requires its current sha, creating a new one requires it omitted, and
// a mismatch is a 409. The local adapter uses git's own blob hash, so a sha
// it reports equals the one GitHub would report for the same bytes.

import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export class StoreConfigError extends Error {}

// Which branch this deployment reads and writes. GITHUB_BRANCH is a manual
// override; VERCEL_GIT_COMMIT_REF is the branch Vercel built this deployment
// from (a system variable, present when the project exposes them, which is
// the default). "main" is the fallback for a bare environment, so a project
// with system variables switched off behaves exactly as before.
export const branchFor = (env) =>
  env.GITHUB_BRANCH || env.VERCEL_GIT_COMMIT_REF || "main";

// FIRMWARE_STORE picks the adapter; `npm run dev:full` sets it to local.
// A bare `vercel dev` injects no VERCEL_* variables at all (checked), so
// nothing about the process itself says "this is a laptop". VERCEL_ENV of
// "development" is honoured for completeness, but anything else — including
// an ABSENT VERCEL_ENV — is GitHub: a deployed function must never fall into
// the local adapter, whose filesystem is read-only.
export const storeKindFor = (env) => {
  if (env.FIRMWARE_STORE === "local" || env.FIRMWARE_STORE === "github") {
    return env.FIRMWARE_STORE;
  }
  return env.VERCEL_ENV === "development" ? "local" : "github";
};

export const storeFor = (env = process.env) =>
  storeKindFor(env) === "local" ? localStore(env) : githubStore(env);

// storeFor() for endpoints: writes the 500 itself and returns null when the
// environment is misconfigured, so the handler is one `if (!store) return`.
export const storeOrRespond = (res, env = process.env) => {
  try {
    return storeFor(env);
  } catch (e) {
    if (!(e instanceof StoreConfigError)) throw e;
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: e.message,
        diagnostic: {
          relatedKeys: Object.keys(env).filter((k) =>
            /^(GITHUB_|ADMIN_|BETA_|FIRMWARE_|VERCEL_ENV|VERCEL_GIT_COMMIT_REF)/.test(k),
          ),
        },
      }),
    );
    return null;
  }
};

// git's blob hash: sha1("blob <byte length>\0<bytes>").
export const blobSha = (bytes) =>
  createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");

const conflict = (msg) => {
  const e = new Error(msg);
  e.status = 409;
  return e;
};

// ---------------------------------------------------------------------------
// Local adapter: the working tree.

export const localStore = (env = process.env) => {
  const root = path.resolve(env.FIRMWARE_ROOT || process.cwd());

  // Paths come from the channel registry plus a validated filename, but the
  // adapter refuses anything outside the tree regardless.
  const resolve = (rel) => {
    const abs = path.resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + path.sep)) {
      throw new Error(`${rel} escapes the firmware root`);
    }
    return abs;
  };

  const get = async (rel) => {
    let bytes;
    try {
      bytes = await readFile(resolve(rel));
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
    return {
      path: rel,
      content: bytes.toString("base64"),
      sha: blobSha(bytes),
      size: bytes.length,
    };
  };

  const put = async (rel, contentBase64, _message, sha) => {
    const existing = await get(rel);
    if (existing && sha !== existing.sha) {
      throw conflict(`PUT ${rel} -> 409: sha mismatch`);
    }
    if (!existing && sha !== undefined) {
      throw conflict(`PUT ${rel} -> 422: sha given for new file`);
    }
    const abs = resolve(rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, Buffer.from(contentBase64, "base64"));
  };

  const del = async (rel, sha, _message) => {
    const existing = await get(rel);
    if (!existing || sha !== existing.sha) {
      throw conflict(`DELETE ${rel} -> 409: sha mismatch`);
    }
    await unlink(resolve(rel));
  };

  return {
    kind: "local",
    branch: "working-tree",
    root,
    historyUrl: null,
    get,
    put,
    del,
    lastCommitDate: async () => null,
  };
};

// ---------------------------------------------------------------------------
// GitHub adapter: the Contents API on one branch.

export const githubStore = (env = process.env) => {
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO;
  const branch = branchFor(env);
  if (!token || !repo) {
    throw new StoreConfigError("GITHUB_TOKEN and GITHUB_REPO must be set");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const contentsUrl = (rel) =>
    `https://api.github.com/repos/${repo}/contents/${encodeURIPath(rel)}`;

  // Raw Contents API record, or null on 404, so readManifest() can tell "file
  // is absent" from "file exists and is empty".
  const get = async (rel) => {
    const res = await fetch(`${contentsUrl(rel)}?ref=${encodeURIComponent(branch)}`, {
      headers,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`GET ${rel} -> ${res.status}: ${msg}`);
    }
    return await res.json();
  };

  const put = async (rel, contentBase64, message, sha) => {
    const payload = { message, content: contentBase64, branch };
    if (sha) payload.sha = sha;
    const res = await fetch(contentsUrl(rel), {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`PUT ${rel} -> ${res.status}: ${msg}`);
    }
    return await res.json();
  };

  const del = async (rel, sha, message) => {
    const res = await fetch(contentsUrl(rel), {
      method: "DELETE",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`DELETE ${rel} -> ${res.status}: ${msg}`);
    }
    return await res.json();
  };

  // Date of the most recent commit touching `rel` on this branch, used to
  // backfill uploadedAt on entries that predate the field. Best effort.
  const lastCommitDate = async (rel) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/commits?path=${encodeURIPath(rel)}&sha=${encodeURIComponent(branch)}&per_page=1`,
        { headers },
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.[0]?.commit?.author?.date ?? null;
    } catch {
      return null;
    }
  };

  return {
    kind: "github",
    branch,
    root: null,
    historyUrl: `https://github.com/${repo}/commits/${branch}`,
    get,
    put,
    del,
    lastCommitDate,
  };
};

const encodeURIPath = (rel) =>
  rel.split("/").map((segment) => encodeURIComponent(segment)).join("/");
