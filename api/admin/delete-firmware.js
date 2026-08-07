// Vercel Node.js serverless function. Removes an admin-uploaded firmware
// from this repo: deletes the .bin/.hex file AND removes its entry from the
// adjacent firmwares.json. Both in separate commits, same pattern as
// upload-firmware.js.
//
// Required env vars (same as upload-firmware.js):
//   ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (optional)

import {
  archiveDirFor,
  dirFor,
  isValidTarget,
  readManifest,
  TARGET_ERROR,
  writeManifests,
} from "./channels.js";

const COOKIE_NAME = "admin_auth";

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
      JSON.stringify({
        error: "GITHUB_TOKEN and GITHUB_REPO must be set",
        diagnostic: {
          hasGITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
          hasGITHUB_REPO: !!process.env.GITHUB_REPO,
          hasADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
          relatedKeys: Object.keys(process.env).filter((k) =>
            /^(GITHUB_|ADMIN_|BETA_|VERCEL_)/.test(k),
          ),
        },
      }),
    );
  }

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `invalid body: ${err.message}` }));
  }

  const { filename, target } = body;
  const err = validate({ filename, target });
  if (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err }));
  }

  const prefix = dirFor(target);
  const filePath = `${prefix}/${filename}`;
  const entryFilepath = `./${filename}`;

  try {
    // 1. Fetch manifest first and refuse if multiple entries share this
    // filepath. New uploads are guarded against duplicates, but historical
    // manifests may still contain aliased entries — deleting one would nuke
    // the shared binary and wipe every matching entry.
    //
    // Reads the admin manifest: deletion targets unlisted entries by design
    // (delete is only offered once unlisted), and those are absent from the
    // public copy.
    const { file: existingManifest, entries, shas } = await readManifest(
      (path) => githubGetFile(repo, path, branch, token),
      target,
    );
    const matches = entries.filter((e) => e.filepath === entryFilepath);
    if (matches.length > 1) {
      res.statusCode = 409;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: `${matches.length} ${target} manifest entries reference "${filename}". Resolve duplicates in GitHub before deleting.`,
        }),
      );
    }

    // 2. Delete the firmware binary from BOTH the served directory and the
    // archive. Delete is only offered on unlisted entries, so the archive is
    // the usual case — but moveBinary deliberately leaves the file in both
    // places when a move fails partway, so checking only one would strand a
    // copy that the manifest no longer references.
    const archivedPath = `${archiveDirFor(target)}/${filename}`;
    for (const path of [filePath, archivedPath]) {
      const existingFile = await githubGetFile(repo, path, branch, token);
      if (existingFile) {
        await githubDeleteFile(
          repo,
          path,
          existingFile.sha,
          branch,
          token,
          `admin: remove ${target} firmware ${filename}`,
        );
      }
    }

    // 3. Strip the manifest entry
    if (existingManifest && matches.length === 1) {
      const filtered = entries.filter((e) => e.filepath !== entryFilepath);
      await writeManifests({
        get: (path) => githubGetFile(repo, path, branch, token),
        put: (path, content, message, sha) =>
          githubPutFile(repo, path, content, branch, token, message, sha),
        target,
        entries: filtered,
        message: `admin: update ${target} manifest to remove ${filename}`,
        shas,
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, target, filename }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `github: ${e.message}` }));
  }
}

function validate({ filename, target }) {
  if (typeof filename !== "string" || !filename)
    return "filename is required";
  if (!/^[A-Za-z0-9_.-]+$/.test(filename))
    return "filename contains illegal characters";
  if (!/\.(bin|hex)$/i.test(filename))
    return "filename must end in .bin or .hex";
  if (!isValidTarget(target)) return TARGET_ERROR;
  return null;
}

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
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
  const payload = { message, content: contentBase64, branch };
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

async function githubDeleteFile(repo, path, sha, branch, token, message) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeURIPath(path)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, sha, branch }),
    },
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`DELETE ${path} -> ${res.status}: ${msg}`);
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
