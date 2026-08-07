// Vercel Node.js serverless function. Accepts an admin-uploaded firmware
// file and commits it (plus a firmwares.json manifest update) to this repo
// via the GitHub contents API. Vercel's auto-deploy picks up the commit so
// the firmware appears in the running app on next build.
//
// Required env vars:
//   ADMIN_PASSWORD — shared with middleware.js, used to verify the auth cookie
//   GITHUB_TOKEN   — fine-grained PAT with contents:write on this repo
//   GITHUB_REPO    — "owner/name" of this repo (e.g. "chasebliss/cba-firmware-interface-program")
//   GITHUB_BRANCH  — optional, defaults to "main"

import {
  dirFor,
  isValidTarget,
  readManifest,
  TARGET_ERROR,
  writeManifests,
} from "./channels.js";

const COOKIE_NAME = "admin_auth";
const MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB hard cap

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  const authed = await verifyAuth(req);
  if (!authed) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "not authenticated" }));
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !repo) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ error: "GITHUB_TOKEN and GITHUB_REPO must be set" }),
    );
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    res.statusCode = err.tooLarge ? 413 : 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: err.tooLarge ? err.message : `invalid body: ${err.message}`,
      }),
    );
  }

  const { filename, contentBase64, target, name, description, bgColor, overwrite } = body;
  const err = validate({ filename, contentBase64, target, name });
  if (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err }));
  }

  const prefix = dirFor(target);
  const filePath = `${prefix}/${filename}`;
  const entryFilepath = `./${filename}`;

  try {
    // Fetch manifest first so we can reject duplicate filenames (unless the
    // client explicitly signalled this is an in-place update via
    // `overwrite: true`). Duplicate `filepath` entries would otherwise alias
    // on delete and blow away multiple manifest rows pointing to the same bin.
    //
    // readManifest reads the ADMIN copy: the public one omits unlisted
    // entries, so checking against it would miss a collision with an unlisted
    // firmware and create exactly the duplicate this guard exists to stop.
    const { entries, shas } = await readManifest(
      (path) => githubGetFile(repo, path, branch, token),
      target,
    );
    const existingIdx = entries.findIndex(
      (e) => e.filepath === entryFilepath,
    );
    if (existingIdx !== -1 && !overwrite) {
      res.statusCode = 409;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: `A ${target} firmware with filename "${filename}" already exists. Rename the file or delete the existing entry first.`,
        }),
      );
    }

    // 1. Commit the firmware binary (re-puts are fine with existing sha).
    const existingFile = await githubGetFile(
      repo,
      filePath,
      branch,
      token,
    );
    const commitVerb = existingIdx !== -1 ? "update" : "add";
    await githubPutFile(
      repo,
      filePath,
      contentBase64,
      branch,
      token,
      `admin: ${commitVerb} ${target} firmware ${name}`,
      existingFile?.sha,
    );

    // 2. Update existing manifest entry in place, or append a new one.
    const now = new Date().toISOString();
    if (existingIdx !== -1) {
      entries[existingIdx] = {
        ...entries[existingIdx],
        name,
        description: description || name,
        bgColor: bgColor || entries[existingIdx].bgColor || "#ba8e51",
        // Preserve uploadedAt — that's the original release date, surfaced to
        // public users via the firmware dropdown. Bump updatedAt instead so
        // the admin row reflects the latest edit.
        updatedAt: now,
      };
    } else {
      const nextId = entries.reduce((m, e) => Math.max(m, e.id), -1) + 1;
      entries.push({
        id: nextId,
        name,
        platform: "models",
        filepath: entryFilepath,
        description: description || name,
        bgColor: bgColor || "#ba8e51",
        active: true,
        uploadedAt: now,
        updatedAt: now,
      });
    }
    await writeManifests({
      get: (path) => githubGetFile(repo, path, branch, token),
      put: (path, content, message, sha) =>
        githubPutFile(repo, path, content, branch, token, message, sha),
      target,
      entries,
      message: `admin: update ${target} manifest for ${name}`,
      shas,
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: true,
        target,
        filename,
        name,
        commitUrl: `https://github.com/${repo}/commits/${branch}`,
      }),
    );
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `github: ${e.message}` }));
  }
}

function validate({ filename, contentBase64, target, name }) {
  if (typeof filename !== "string" || !filename)
    return "filename is required";
  if (!/^[A-Za-z0-9_.-]+$/.test(filename))
    return "filename contains illegal characters";
  if (!/\.(bin|hex)$/i.test(filename))
    return "filename must end in .bin or .hex";
  if (typeof contentBase64 !== "string" || !contentBase64)
    return "contentBase64 is required";
  if (!isValidTarget(target)) return TARGET_ERROR;
  if (typeof name !== "string" || !name.trim()) return "name is required";
  return null;
}

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let total = 0;
    let body = "";
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        const e = new Error("request body too large");
        e.tooLarge = true;
        reject(e);
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function githubGetFile(repo, path, branch, token) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIPath(path)}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`GET ${path} -> ${res.status}: ${msg}`);
  }
  return await res.json();
}

async function githubPutFile(repo, path, contentBase64, branch, token, message, sha) {
  const payload = {
    message,
    content: contentBase64,
    branch,
  };
  if (sha) payload.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIPath(path)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`PUT ${path} -> ${res.status}: ${msg}`);
  }
  return await res.json();
}

function encodeURIPath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function verifyAuth(req) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const expected = await signOk(password);
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const value = match.slice(COOKIE_NAME.length + 1);
  return constantTimeEqual(value, expected);
}

async function signOk(password) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("ok"),
  );
  return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
