// Vercel Node.js serverless function. Returns the production + beta firmware
// manifests straight from the GitHub Contents API (auth'd with GITHUB_TOKEN)
// so the /admin view can show live repo state without waiting for a Vercel
// redeploy to refresh the served public/ bundle. The repo is private, so the
// client can't hit raw.githubusercontent.com directly — this proxy is the
// only way to read live manifest state from the browser.
//
// Auth-gated on the admin_auth cookie (ADMIN_PASSWORD), same as upload/delete.

const COOKIE_NAME = "admin_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
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

  try {
    const [productionRaw, betaRaw] = await Promise.all([
      fetchManifest(repo, "public/firmware/firmwares.json", branch, token),
      fetchManifest(repo, "public/beta/firmware/firmwares.json", branch, token),
    ]);
    // Fill in uploadedAt for entries missing it (older uploads pre-dating the
    // field) by asking GitHub for the most recent commit that touched the
    // corresponding binary. One extra API call per such entry; fine for small N.
    const [production, beta] = await Promise.all([
      backfillUploadedAt(productionRaw, "public/firmware", branch, token, repo),
      backfillUploadedAt(
        betaRaw,
        "public/beta/firmware",
        branch,
        token,
        repo,
      ),
    ]);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ production, beta }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `github: ${e.message}` }));
  }
}

async function backfillUploadedAt(entries, prefix, branch, token, repo) {
  return Promise.all(
    entries.map(async (entry) => {
      if (entry.uploadedAt) return entry;
      const file = (entry.filepath || "").replace(/^\.\//, "");
      if (!file) return entry;
      const date = await fetchLastCommitDate(
        repo,
        `${prefix}/${file}`,
        branch,
        token,
      );
      return date ? { ...entry, uploadedAt: date } : entry;
    }),
  );
}

async function fetchLastCommitDate(repo, path, branch, token) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits?path=${encodeURIPath(path)}&sha=${encodeURIComponent(branch)}&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.[0]?.commit?.author?.date ?? null;
  } catch {
    return null;
  }
}

async function fetchManifest(repo, path, branch, token) {
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
  if (res.status === 404) return [];
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`GET ${path} -> ${res.status}: ${msg}`);
  }
  const data = await res.json();
  const decoded = Buffer.from(data.content, "base64").toString("utf8");
  return JSON.parse(decoded);
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
