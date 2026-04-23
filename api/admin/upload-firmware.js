// Vercel Node.js serverless function. Accepts an admin-uploaded firmware
// file and commits it (plus a firmwares.json manifest update) to this repo
// via the GitHub contents API. Vercel's auto-deploy picks up the commit so
// the firmware appears in the running app on next build.
//
// Required env vars:
//   BETA_PASSWORD — shared with middleware.js, used to verify the auth cookie
//   GITHUB_TOKEN  — fine-grained PAT with contents:write on this repo
//   GITHUB_REPO   — "owner/name" of this repo (e.g. "jsfowles/bliss-programmer")
//   GITHUB_BRANCH — optional, defaults to "main"

const COOKIE_NAME = "beta_auth";
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

  const { filename, contentBase64, target, name, description, bgColor } = body;
  const err = validate({ filename, contentBase64, target, name });
  if (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: err }));
  }

  const prefix =
    target === "beta" ? "public/beta/firmware" : "public/firmware";
  const filePath = `${prefix}/${filename}`;
  const manifestPath = `${prefix}/firmwares.json`;
  const entryFilepath = `./${filename}`;

  try {
    // Fetch manifest first so we can reject duplicate filenames before touching
    // the binary. Duplicate `filepath` entries create an aliasing bug: a later
    // delete filters by filepath and would remove all matching entries plus
    // the shared binary.
    const existingManifest = await githubGetFile(
      repo,
      manifestPath,
      branch,
      token,
    );
    const entries = existingManifest
      ? JSON.parse(
          Buffer.from(existingManifest.content, "base64").toString("utf8"),
        )
      : [];
    if (entries.some((e) => e.filepath === entryFilepath)) {
      res.statusCode = 409;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: `A ${target} firmware with filename "${filename}" already exists. Rename the file or delete the existing entry first.`,
        }),
      );
    }

    // 1. Commit the firmware binary
    const existingFile = await githubGetFile(
      repo,
      filePath,
      branch,
      token,
    );
    await githubPutFile(
      repo,
      filePath,
      contentBase64,
      branch,
      token,
      `admin: add ${target} firmware ${name}`,
      existingFile?.sha,
    );

    // 2. Append manifest entry, commit
    const nextId = entries.reduce((m, e) => Math.max(m, e.id), -1) + 1;
    entries.push({
      id: nextId,
      name,
      platform: "models",
      filepath: entryFilepath,
      description: description || name,
      bgColor: bgColor || "#ba8e51",
      active: true,
      uploadedAt: new Date().toISOString(),
    });
    const newContent = Buffer.from(
      JSON.stringify(entries, null, 2) + "\n",
    ).toString("base64");
    await githubPutFile(
      repo,
      manifestPath,
      newContent,
      branch,
      token,
      `admin: update ${target} manifest for ${name}`,
      existingManifest?.sha,
    );

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
  if (target !== "production" && target !== "beta")
    return "target must be 'production' or 'beta'";
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
  const password = process.env.BETA_PASSWORD;
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
