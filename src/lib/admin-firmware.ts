// Shared types + constants for the /admin route. Imported by LocalFlasher and
// the AdminFirmware* components so they don't have to ferry these through
// props or redefine them.

export type FlashStatus =
  | "idle"
  | "preparing"
  | "installing"
  | "complete"
  | "error";

export type SaveTarget = "production" | "beta";

export type ConnectStatus = "disconnected" | "connecting" | "connected";

export type SaveStatus = "idle" | "saving" | "success" | "error";

export type DeployStatus = "checking" | "live" | "pending";

export interface ManifestEntry {
  name: string;
  filepath: string;
  bgColor?: string;
  description?: string;
  uploadedAt?: string;
  updatedAt?: string;
  active?: boolean;
}

export interface AdminFirmware {
  name: string;
  filename: string;
  target: SaveTarget;
  bgColor: string;
  description: string;
  uploadedAt: string | null;
  updatedAt: string | null;
  active: boolean;
}

export const GOLD = "#ba8e51";

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
  target: "beta",
  bgColor: FAKE_BG_COLOR,
  description: "In-memory fake — runs the full flash flow without a real pedal.",
  uploadedAt: null,
  updatedAt: null,
  active: true,
};
