// The channel registry, server side. Mirrors CHANNELS in
// src/lib/admin-firmware.ts — that copy is the one the browser bundle uses,
// this one is what the serverless functions import. They're duplicated because
// api/*.js runs on Vercel's Node runtime with no TypeScript transpile step, so
// it can't import from src/.
//
// Keep the two in sync. If they drift, the symptom is a target the UI offers
// but the API rejects with a 400 (or worse, a directory mismatch), so add
// channels to both or neither.

export const CHANNELS = [
  { id: "production", label: "Production", dir: "public/firmware" },
  { id: "beta", label: "Beta", dir: "public/beta/firmware" },
  { id: "nightly", label: "Nightly", dir: "public/nightly/firmware" },
];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id);

export function isValidTarget(target) {
  return CHANNELS.some((c) => c.id === target);
}

// Returns the repo directory a channel's files live in. Throws on an unknown
// target rather than defaulting — callers validate first, so reaching here with
// a bad target is a bug, and silently writing to public/firmware is the exact
// failure mode this registry exists to prevent.
export function dirFor(target) {
  const channel = CHANNELS.find((c) => c.id === target);
  if (!channel) throw new Error(`Unknown firmware target: ${target}`);
  return channel.dir;
}

export const TARGET_ERROR = `target must be one of: ${CHANNEL_IDS.join(", ")}`;
