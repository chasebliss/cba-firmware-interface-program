// Asserts the two channel registries stay in sync.
//
// CHANNELS is deliberately duplicated between src/lib/admin-firmware.ts (the
// browser bundle) and api/admin/channels.js (the serverless functions), because
// Vercel's Node runtime has no TypeScript transpile step and can't import from
// src/. Both files carry a comment saying "keep the two in sync" — this makes
// that enforceable instead of aspirational.
//
// The drift this catches: a channel added to one file but not the other, which
// surfaces as the UI offering a target the API rejects with a 400.
//
// Run: node api/admin/channels.test.mjs

import { readFileSync } from "node:fs";
import { ADMIN_MANIFEST, CHANNELS, PUBLIC_MANIFEST } from "./channels.js";

let failures = 0;
const check = (label, condition) => {
  if (!condition) failures++;
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`);
};

// Parse the client registry out of the TS source. Crude, but it avoids pulling
// a transpiler in just for this, and any change that breaks the parse is itself
// worth a look.
const ts = readFileSync(
  new URL("../../src/lib/admin-firmware.ts", import.meta.url),
  "utf8",
);
const block = ts.slice(
  ts.indexOf("export const CHANNELS"),
  ts.indexOf("] as const;"),
);
const field = (name) =>
  [...block.matchAll(new RegExp(`${name}: "([^"]+)"`, "g"))].map((m) => m[1]);

const clientIds = field("id");
const clientBases = field("publicBase");
const serverIds = CHANNELS.map((c) => c.id);

check(
  `ids match (client: ${clientIds.join(",")} | server: ${serverIds.join(",")})`,
  JSON.stringify(clientIds) === JSON.stringify(serverIds),
);

// publicBase is the URL form of the server's dir, minus the public/ prefix.
CHANNELS.forEach((channel, i) => {
  const expected = `/${channel.dir.replace(/^public\//, "")}/`;
  check(
    `publicBase[${channel.id}] matches dir (${clientBases[i]})`,
    clientBases[i] === expected,
  );
});

// The archive must never be inside public/, or unlisted firmware would still
// be built and served — the exact thing archiving exists to prevent.
CHANNELS.forEach((channel) => {
  check(
    `${channel.id} archiveDir is unserved (${channel.archiveDir})`,
    !channel.archiveDir.startsWith("public/"),
  );
  check(
    `${channel.id} dir is served (${channel.dir})`,
    channel.dir.startsWith("public/"),
  );
});

// The public pages fetch each channel's manifest by URL from sources.ts. Those
// URLs must line up with the server's dirs, or a channel's page silently loads
// nothing — and must point at the PUBLIC manifest, never the admin one.
const sources = readFileSync(
  new URL("../../src/data/sources.ts", import.meta.url),
  "utf8",
);
const dataUrls = [...sources.matchAll(/data_url: "([^"]+)"/g)].map((m) => m[1]);

CHANNELS.forEach((channel) => {
  const expected = `/${channel.dir.replace(/^public\//, "")}/${PUBLIC_MANIFEST}`;
  check(
    `sources.ts fetches ${channel.id} from ${expected}`,
    dataUrls.includes(expected),
  );
});

check(
  "no page fetches the admin manifest",
  !sources.includes(ADMIN_MANIFEST),
);

// readManifest/writeManifests take a channel ID, not a directory. Both are
// plain strings, so passing the wrong one type-checks fine and only fails at
// runtime — which is exactly what shipped once: list-firmwares passed
// `channel.dir` and the admin dashboard broke with "Unknown firmware target:
// public/firmware". Assert the call sites pass an id-shaped argument.
const API_FILES = [
  "list-firmwares.js",
  "upload-firmware.js",
  "update-firmware.js",
  "delete-firmware.js",
];

for (const name of API_FILES) {
  const src = readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

  // Calls span multiple lines. The second argument is always on its own line
  // immediately before the closing paren, so match that line directly rather
  // than trying to parse the whole argument list.
  const calls = [
    ...src.matchAll(/readManifest\(\s*\([^)]*\)\s*=>[\s\S]*?,\s*\n\s*([^,\n]+),\s*\n\s*\)/g),
  ].map((m) => m[1].trim());

  check(`${name}: readManifest call sites found`, calls.length > 0);
  calls.forEach((arg) => {
    check(
      `${name}: readManifest receives an id, not a dir (got \`${arg}\`)`,
      arg === "target" || arg === "channel.id",
    );
  });

  // Same for writeManifests — it must be handed `target`, never `dir:`.
  check(
    `${name}: writeManifests takes no dir: argument`,
    !/writeManifests\(\{[^}]*\bdir:/s.test(src),
  );
}

console.log(
  failures === 0
    ? "\nRegistries in sync."
    : `\n${failures} check(s) FAILED — the two CHANNELS registries have drifted.`,
);
process.exit(failures === 0 ? 0 : 1);
