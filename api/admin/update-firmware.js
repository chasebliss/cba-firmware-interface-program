// Vercel Node.js serverless function. Updates a single firmware's manifest
// entry (metadata only — no binary touch). Used by /admin to toggle active,
// rename, or change accent color without re-uploading the .bin/.hex.
//
// Required env vars (same as upload-firmware.js):
//   ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO (see store.js for the branch)

import {
  archiveDirFor,
  dirFor,
  isValidTarget,
  moveBinary,
  readManifest,
  TARGET_ERROR,
  writeManifests,
} from "./channels.js";
import { storeOrRespond } from "./store.js";

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

  const store = storeOrRespond(res);
  if (!store) return;

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
  if (!isValidTarget(target)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: TARGET_ERROR }));
  }
  if (!patch || typeof patch !== "object") {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({ error: "patch object is required" }),
    );
  }

  const prefix = dirFor(target);
  const entryFilepath = `./${filename}`;

  try {
    const { file: existingManifest, entries, shas } = await readManifest(store.get, target);
    if (!existingManifest) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ error: `${target} manifest not found` }));
    }
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
    if (typeof patch.pedal === "string" && patch.pedal.trim()) {
      next.pedal = patch.pedal.trim();
    }
    if (typeof patch.description === "string") {
      next.description = patch.description.trim();
    }
    if (typeof patch.internalNotes === "string") {
      next.internalNotes = patch.internalNotes.trim();
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
      ? "unlist"
      : patch.active === true
        ? "list"
        : "update";
    const commitMessage = `admin: ${verb} ${target} firmware ${next.name}`;

    // The binary move gets its own verb. Reusing the manifest's would produce
    // "unlist … (copy)" for the commit that copies the file INTO the archive,
    // which describes the request rather than what happened to the file.
    const moveVerb = patch.active === false ? "archive" : "restore";
    const moveMessage = `admin: ${moveVerb} ${target} firmware ${next.name}`;

    const io = { get: store.get, put: store.put, del: store.del };
    const servedPath = `${prefix}/${filename}`;
    const archivedPath = `${archiveDirFor(target)}/${filename}`;

    // Order both directions so the invariant "if the manifest lists it, the
    // file is there" always holds, even if the second step never runs:
    //
    //   unlist — drop it from the manifest, THEN archive the binary. A failure
    //            in between leaves an unlisted-but-still-served file: not yet
    //            the requested state, but nothing is broken and a retry
    //            finishes it.
    //   list   — restore the binary, THEN add it to the manifest. A failure in
    //            between leaves a served-but-unlisted file: same benign shape.
    //
    // The reverse of either would publish a manifest entry pointing at a file
    // that isn't there, so the picker would offer a firmware that 404s.
    if (patch.active === false) {
      await writeManifests({
        ...io,
        target,
        entries,
        message: commitMessage,
        shas,
      });
      await moveBinary({
        ...io,
        from: servedPath,
        to: archivedPath,
        message: moveMessage,
      });
    } else {
      if (patch.active === true) {
        await moveBinary({
          ...io,
          from: archivedPath,
          to: servedPath,
          message: moveMessage,
        });
      }
      await writeManifests({
        ...io,
        target,
        entries,
        message: commitMessage,
        shas,
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, target, filename, entry: next }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `${store.kind}: ${e.message}` }));
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
