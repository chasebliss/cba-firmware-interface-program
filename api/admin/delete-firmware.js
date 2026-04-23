// Vercel Node.js serverless function. Removes an admin-uploaded firmware
// from this repo: deletes the .bin/.hex file AND removes its entry from the
// adjacent firmwares.json. Both in separate commits, same pattern as
// upload-firmware.js.
//
// Required env vars (same as upload-firmware.js):
//   BETA_PASSWORD, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (optional)

const COOKIE_NAME = "beta_auth";

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
          hasBETA_PASSWORD: !!process.env.BETA_PASSWORD,
          relatedKeys: Object.keys(process.env).filter((k) =>
            /^(GITHUB_|BETA_|VERCEL_)/.test(k),
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

  const prefix =
    target === "beta" ? "public/beta/firmware" : "public/firmware";
  const filePath = `${prefix}/${filename}`;
  const manifestPath = `${prefix}/firmwares.json`;
  const entryFilepath = `./${filename}`;

  try {
    // 1. Fetch manifest first and refuse if multiple entries share this
    // filepath. New uploads are guarded against duplicates, but historical
    // manifests may still contain aliased entries — deleting one would nuke
    // the shared binary and wipe every matching entry.
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

    // 2. Delete the firmware binary
    const existingFile = await githubGetFile(repo, filePath, branch, token);
    if (existingFile) {
      await githubDeleteFile(
        repo,
        filePath,
        existingFile.sha,
        branch,
        token,
        `admin: remove ${target} firmware ${filename}`,
      );
    }

    // 3. Strip the manifest entry
    if (existingManifest && matches.length === 1) {
      const filtered = entries.filter((e) => e.filepath !== entryFilepath);
      const newContent = Buffer.from(
        JSON.stringify(filtered, null, 2) + "\n",
      ).toString("base64");
      await githubPutFile(
        repo,
        manifestPath,
        newContent,
        branch,
        token,
        `admin: update ${target} manifest to remove ${filename}`,
        existingManifest.sha,
      );
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
  if (target !== "production" && target !== "beta")
    return "target must be 'production' or 'beta'";
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
