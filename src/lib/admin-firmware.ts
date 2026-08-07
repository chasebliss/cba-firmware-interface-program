// Shared types + constants for the /admin route. Imported by LocalFlasher and
// the AdminFirmware* components so they don't have to ferry these through
// props or redefine them.

export type FlashStatus =
  | "idle"
  | "preparing"
  | "installing"
  | "complete"
  | "error";

const GOLD_HEX = "#ba8e51";

// The channel registry. Every place that needs to know "what channels exist"
// reads this instead of spelling out the targets — adding a fourth channel is
// one entry here plus a route in App.tsx, not a hunt for hardcoded ternaries.
//
// `dir` is the repo path the API commits to; `publicBase` is the URL the
// served asset resolves at. They differ only by the "public/" prefix, but
// keeping both explicit means neither has to be derived by string surgery at
// the call site. `route` is the page that serves the channel to users — the
// admin list links its section headers there.
//
// Order matters: it's the order sections render in the admin list and the
// order radios appear in the save form.
export const CHANNELS = [
  {
    id: "production",
    label: "Production",
    dir: "public/firmware",
    publicBase: "/firmware/",
    route: "/",
    color: "var(--color-green)",
  },
  {
    id: "beta",
    label: "Beta",
    dir: "public/beta/firmware",
    publicBase: "/beta/firmware/",
    route: "/beta",
    color: GOLD_HEX,
  },
  {
    id: "nightly",
    label: "Nightly",
    dir: "public/nightly/firmware",
    publicBase: "/nightly/firmware/",
    route: "/nightly",
    color: "#6366f1",
  },
] as const;

export type SaveTarget = (typeof CHANNELS)[number]["id"];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id) as readonly SaveTarget[];

export const isSaveTarget = (v: unknown): v is SaveTarget =>
  typeof v === "string" && CHANNEL_IDS.includes(v as SaveTarget);

// Lookup rather than a ternary chain: an unrecognized target returns undefined
// so callers fail loudly, instead of silently falling through to production.
export const channelFor = (target: SaveTarget) =>
  CHANNELS.find((c) => c.id === target);

export const publicBaseFor = (target: SaveTarget): string => {
  const channel = channelFor(target);
  if (!channel) throw new Error(`Unknown firmware target: ${target}`);
  return channel.publicBase;
};

export type ConnectStatus = "disconnected" | "connecting" | "connected";

export type SaveStatus = "idle" | "saving" | "success" | "error";

// Publish progress. This is ONE axis only: where the file is in the
// commit → build → CDN pipeline. It deliberately says nothing about whether
// users can see the firmware — that's the listing axis below.
//
// The old model collapsed both into a single coloured dot, where red meant
// "you unlisted this on purpose" and so read as an error. Every tool surveyed
// in docs/research/release-channel-ux-patterns.md keeps these separate and
// names the states rather than colouring them.
export type DeployStatus = "checking" | "live" | "pending";

// Deliberately NOT "Published" — that reads as a synonym for "Listed", so a
// row saying "Published · Unlisted" looks self-contradictory. This axis is
// about the file reaching the site at all, so it's phrased as the upload
// finishing: "Uploading…" while the build runs, nothing once it's done.
export const DEPLOY_STATUS_LABEL: Record<DeployStatus, string> = {
  checking: "Checking…",
  pending: "Uploading…",
  live: "On site",
};

export const DEPLOY_STATUS_HELP: Record<DeployStatus, string> = {
  checking: "Checking whether the file has reached the site yet.",
  pending:
    "Saved. The site is rebuilding and the file will be downloadable in about 30 seconds.",
  live: "The file is on the site and can be downloaded.",
};

export interface ManifestEntry {
  name: string;
  filepath: string;
  bgColor?: string;
  description?: string;
  uploadedAt?: string;
  updatedAt?: string;
  active?: boolean;
}

// The mock pedal row isn't real firmware and doesn't live in any channel, so
// it carries this sentinel instead of squatting in one. Rows tagged with it
// render in their own section and are never sent to the upload/update/delete
// APIs — those validate against CHANNEL_IDS, which excludes it by construction.
export const MOCK_TARGET = "__mock__";

export type RowTarget = SaveTarget | typeof MOCK_TARGET;

export interface AdminFirmware {
  name: string;
  filename: string;
  target: RowTarget;
  bgColor: string;
  description: string;
  uploadedAt: string | null;
  updatedAt: string | null;
  // Whether the channel's public page lists this firmware. Stored as `active`
  // in the manifest (unchanged on disk — renaming the field would break every
  // existing entry), but presented as listed/unlisted throughout the UI.
  active: boolean;
}

// The listing axis: is this firmware offered to users on its channel's page?
// Independent of DeployStatus — a firmware can be published-but-unlisted (file
// is served, page doesn't offer it) or listed-but-publishing (page will offer
// it once the build lands).
//
// "Unlist" over "hide" is deliberate: it names what actually happens (it drops
// out of the page's dropdown) and pairs with a visible "List" undo. None of the
// seven tools surveyed use "hide" for this; the ones that soft-remove all use a
// verb that says what still works afterward.
export const LISTING_LABEL = {
  listed: "Listed",
  unlisted: "Unlisted",
} as const;

export const listingHelp = (listed: boolean, channelLabel: string): string =>
  listed
    ? `Shown in the firmware picker on the ${channelLabel} page.`
    : `Removed from the ${channelLabel} page. Unlisting also takes the file off the site, so the direct link stops working. It's kept in the repo, so listing it again restores it.`;

// Narrows a catalogue row to one that lives in a real channel — i.e. not the
// mock. Use before anything that resolves a repo path or CDN URL, since the
// mock has neither.
export const isRealFirmware = (
  fw: AdminFirmware,
): fw is AdminFirmware & { target: SaveTarget } => isSaveTarget(fw.target);

export const GOLD = GOLD_HEX;

export const DEFAULT_TRANSFER_SIZE = 1024;

// Synthetic catalogue row that swaps the WebUSB connect for an in-memory fake
// pedal. Loading it primes a 256KB synthetic payload so Update has something
// to flash; Connect then routes to connectToFakeDevice() instead of the
// browser's USB picker. Filename is a sentinel — never written to the manifest
// or fetched from the CDN.
export const FAKE_FILENAME = "__fake__";
export const FAKE_BG_COLOR = "#8b5cf6";
export const FAKE_PAYLOAD_BYTES = 256 * 1024;

export const FAKE_ENTRY: AdminFirmware = {
  name: "Mock Pedal (no hardware)",
  filename: FAKE_FILENAME,
  target: MOCK_TARGET,
  bgColor: FAKE_BG_COLOR,
  description: "In-memory fake — runs the full flash flow without a real pedal.",
  uploadedAt: null,
  updatedAt: null,
  active: true,
};
