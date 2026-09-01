// Vercel Node.js serverless function. Returns every channel's firmware
// manifest straight from the firmware store (see store.js: GitHub on the
// branch this deployment was built from, or the working tree under
// `vercel dev`) so the /admin view shows live state without waiting for a
// redeploy. The repo is private, so the client can't hit
// raw.githubusercontent.com directly — this proxy is the only way to read
// live manifest state from the browser.
//
// The X-Firmware-Store / X-Firmware-Branch response headers say which store
// answered, so the admin page can show where a save will land.
//
// Auth-gated on the admin_auth cookie (ADMIN_PASSWORD), same as upload/delete.
//
// Response shape is one key per channel: { production: [...], beta: [...],
// nightly: [...] }. Adding a channel to the registry adds a key here.

import { CHANNELS, readManifest } from "./channels.js";
import { storeOrRespond } from "./store.js";

const COOKIE_NAME = "admin_auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method Not Allowed");
  }

  const store = storeOrRespond(res);
  if (!store) return;
  res.setHeader("X-Firmware-Store", store.kind);
  res.setHeader("X-Firmware-Branch", store.branch);

  const authed = await verifyAuth(req);
  if (!authed) {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "not authenticated" }));
  }


  try {
    // One manifest fetch per channel, then backfill uploadedAt for entries
    // missing it (older uploads pre-dating the field) by asking GitHub for the
    // most recent commit that touched the corresponding binary. One extra API
    // call per such entry; fine for small N.
    const byChannel = await Promise.all(
      CHANNELS.map(async (channel) => {
        const { entries: raw } = await readManifest(store.get, channel.id);
        const entries = await backfillUploadedAt(raw, channel.dir, store);
        return [channel.id, entries];
      }),
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify(Object.fromEntries(byChannel)));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: `${store.kind}: ${e.message}` }));
  }
}

async function backfillUploadedAt(entries, prefix, store) {
  return Promise.all(
    entries.map(async (entry) => {
      if (entry.uploadedAt) return entry;
      const file = (entry.filepath || "").replace(/^\.\//, "");
      if (!file) return entry;
      const date = await store.lastCommitDate(`${prefix}/${file}`);
      return date ? { ...entry, uploadedAt: date } : entry;
    }),
  );
}

// Returns the raw Contents API record, or null on 404 — the same shape the
// other admin functions use, so readManifest() can tell "file is absent" from
// "file exists and is empty". Distinguishing those is the whole point: an
// empty admin manifest is a legitimate state (every entry unlisted) and must
// not fall back to the stale public copy.
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
