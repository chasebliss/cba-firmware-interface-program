import type { FirmwareSource } from "@/data/sources";
import { isHexPath, parseIntelHex, type FirmwareSegment } from "./dfu";

interface RawFirmware {
  id: number;
  name: string;
  pedal?: string;
  platform: string;
  filepath: string;
  description: string;
  bgColor: string;
  active: boolean;
  uploadedAt?: string;
}

export interface FirmwareEntry {
  id: number;
  name: string;
  // The product this firmware is for, e.g. "MOOD MKII". Groups versions on
  // the release-notes page. Required on new uploads; entries written before
  // the field existed were backfilled, so an empty string here means the
  // firmware predates the backfill and has no history page.
  pedal: string;
  platform: string;
  description: string;
  bgColor: string;
  active: boolean;
  filename: string; // basename of filepath, e.g. "MOOD_MKII_1.1.bin"
  url: string; // resolved absolute URL to the .bin or .hex file
  uploadedAt: string | null;
  source: FirmwareSource;
}

export type FirmwarePayload =
  | { kind: "bin"; buffer: ArrayBuffer }
  | { kind: "hex"; segments: FirmwareSegment[] };

// Manifests store filepaths as "./<basename>"; everything downstream wants
// the bare basename. One spelling of the rule — the admin mapper and this
// loader both use it.
export const filenameOf = (filepath: string): string =>
  filepath.replace(/^\.\//, "");

// Case-insensitive name order. Returns 0 on equal names so the sort is
// genuinely stable — two earlier inline copies returned 1 there, which let
// equal names swap between loads.
export const byName = (a: { name: string }, b: { name: string }): number => {
  const an = a.name.toLowerCase();
  const bn = b.name.toLowerCase();
  return an < bn ? -1 : an > bn ? 1 : 0;
};

// A note line plus how deep it sits. Depth 0 is a top-level change, depth 1
// is a sub-point under it. Deeper indentation is clamped to 1: a sidebar
// column has no room for a third level, and pasted text arrives with all
// sorts of leading whitespace.
export interface NoteItem {
  text: string;
  depth: 0 | 1;
}

// Structured form of a notes field. One change per line is the only
// structure notes have, and an indent nests one line under the previous.
// Split rather than rendering with whitespace-pre-line: blank lines from
// pasted text would otherwise show as gaps. Both the leading bullet marker
// and the indent are optional, so a plain unindented list still parses,
// which is what every note written before markdown support looks like.
// Used for public release notes and the admin-only internal notes alike.
export const noteItems = (notes: string | undefined): NoteItem[] => {
  const TAB_WIDTH = 4;
  return (notes ?? "")
    .split("\n")
    .map((raw) => {
      const expanded = raw.replace(/\t/g, " ".repeat(TAB_WIDTH));
      const indent = expanded.length - expanded.trimStart().length;
      // Strip one leading bullet marker if present. The marker is optional,
      // so "- foo" and "foo" produce the same item.
      const text = expanded
        .trim()
        .replace(/^[-*+]\s+/, "")
        .trim();
      // Two spaces is the shallowest indent that reads as deliberate. Below
      // that, treat it as a stray space rather than a nesting intent.
      return { text, depth: (indent >= 2 ? 1 : 0) as 0 | 1 };
    })
    .filter((item) => item.text.length > 0);
};

// Every distinct pedal across `entries`, trimmed and sorted. Entries from
// before the pedal backfill carry "" and are skipped.
export const pedalsIn = (entries: Array<{ pedal: string }>): string[] => {
  const names = entries.map((e) => e.pedal.trim()).filter((p) => p.length > 0);
  return Array.from(new Set(names)).sort((a, b) =>
    byName({ name: a }, { name: b }),
  );
};

// Every version of one pedal, newest release first. uploadedAt is the
// original release date and survives edits, so it stays stable as a sort key.
export const versionsOf = <
  T extends { pedal: string; uploadedAt: string | null },
>(
  entries: T[],
  pedal: string,
): T[] =>
  entries
    .filter((e) => e.pedal.trim() === pedal.trim())
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""));

export const loadFirmwareCatalogue = async (
  sources: FirmwareSource[],
): Promise<FirmwareEntry[]> => {
  const lists = await Promise.all(
    sources.map(async (source) => {
      const resp = await fetch(source.data_url);
      if (!resp.ok) {
        throw new Error(
          `Failed to fetch ${source.data_url}: ${resp.status} ${resp.statusText}`,
        );
      }
      const raw = (await resp.json()) as RawFirmware[];
      const base = /^https?:\/\//.test(source.repo_url)
        ? source.repo_url
        : new URL(source.repo_url, window.location.origin).toString();
      return raw.map((r): FirmwareEntry => {
        const filename = filenameOf(r.filepath);
        return {
          id: r.id,
          name: r.name,
          pedal: r.pedal ?? "",
          platform: r.platform,
          description: r.description,
          bgColor: r.bgColor,
          active: r.active,
          filename,
          url: new URL(r.filepath, base).toString(),
          uploadedAt: r.uploadedAt ?? null,
          source,
        };
      });
    }),
  );

  return lists.flat().sort(byName);
};

export const fetchFirmwarePayload = async (
  entry: FirmwareEntry,
): Promise<FirmwarePayload> => {
  const resp = await fetch(entry.url);
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch firmware (${resp.status} ${resp.statusText}): ${entry.url}`,
    );
  }
  if (isHexPath(entry.url)) {
    const text = await resp.text();
    return { kind: "hex", segments: parseIntelHex(text) };
  }
  return { kind: "bin", buffer: await resp.arrayBuffer() };
};
