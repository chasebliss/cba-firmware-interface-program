// Vercel Node.js serverless function. Updates a single firmware's manifest
// entry (metadata only — no binary touch). Used by /admin to toggle active,
// rename, or change accent color without re-uploading the .bin/.hex.
//
// Required env vars (same as upload-firmware.js):
//   ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (optional)

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
      JSON.stringify({ error: "GITHUB_TOKEN and GITHUB_REPO must be set" }),
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

  const { filename, target, patch } = body;
  if (typeof filename !== "string" || !filename) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "filename is required" }));
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(filename)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ error: "filename contains illegal characters" }),
    );
  }
  if (target !== "production" && target !== "beta") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ error: "target must be 'production' or 'beta'" }),
    );
  }
  if (!patch || typeof patch !== "object") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ error: "patch object is required" }),
    );
  }

  const prefix =
    target === "beta" ? "public/beta/firmware" : "public/firmware";
  const manifestPath = `${prefix}/firmwares.json`;
  const entryFilepath = `./${filename}`;

  try {
    const existingManifest = await githubGetFile(
      repo,
      manifestPath,
      branch,
      token,
    );
    if (!existingManifest) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: `${target} manifest not found` }));
    }
    const entries = JSON.parse(
      Buffer.from(existingManifest.content, "base64").toString("utf8"),
    );
    const idx = entries.findIndex((e) => e.filepath === entryFilepath);
    if (idx === -1) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          error: `No ${target} entry for "${filename}".`,
        }),
      );
    }

    // Allowlist of patchable fields. Never let the client change filepath, id,
    // platform, or uploadedAt via this endpoint — those are structural.
    const next = { ...entries[idx] };
    if (typeof patch.name === "string" && patch.name.trim()) {
      next.name = patch.name.trim();
    }
    if (typeof patch.description === "string") {
      next.description = patch.description.trim() || next.name;
    }
    if (typeof patch.bgColor === "string" && /^#[0-9a-fA-F]{6}$/.test(patch.bgColor)) {
      next.bgColor = patch.bgColor;
    }
    if (typeof patch.active === "boolean") {
      next.active = patch.active;
    }
    next.updatedAt = new Date().toISOString();
    entries[idx] = next;

    const verb = patch.active === false
      ? "hide"
      : patch.active === true
        ? "show"
        : "update";
    const newContent = Buffer.from(
      JSON.stringify(entries, null, 2) + "\n",
    ).toString("base64");
    await githubPutFile(
      repo,
      manifestPath,
      newContent,
      branch,
      token,
      `admin: ${verb} ${target} firmware ${next.name}`,
      existingManifest.sha,
    );

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, target, filename, entry: next }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `github: ${e.message}` }));
  }
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
