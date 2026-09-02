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
export type NoteBlock =
  | { kind: "li"; text: string; depth: 0 | 1 }
  | { kind: "p"; text: string };

// Structured form of a notes field, a small subset of markdown:
//
//   - a line starting with "-", "*" or "+" is a bullet
//   - a bullet indented two spaces (or a tab) nests under the one above
//   - any other line is prose; consecutive lines join into one paragraph
//     and a blank line starts the next
//   - a line indented under a bullet continues that bullet
//
// Earlier notes were "one change per line, marker optional", which made a
// plain sentence render as a lone bullet and gave no way to write a
// paragraph. Every note written before this rule is a single sentence, so
// they now read as the paragraph they were.
//
// Used for public release notes and the admin-only internal notes alike.
export const noteBlocks = (notes: string | undefined): NoteBlock[] => {
  const TAB_WIDTH = 4;
  const blocks: NoteBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };

  for (const raw of (notes ?? "").split("\n")) {
    const expanded = raw.replace(/\t/g, " ".repeat(TAB_WIDTH));
    const indent = expanded.length - expanded.trimStart().length;
    const text = expanded.trim();
    const bullet = /^[-*+]\s+(.*)$/.exec(text);

    if (text.length === 0) {
      flush();
    } else if (bullet) {
      flush();
      // Two spaces is the shallowest indent that reads as deliberate. Below
      // that, treat it as a stray space rather than a nesting intent.
      blocks.push({
        kind: "li",
        text: bullet[1].trim(),
        depth: indent >= 2 ? 1 : 0,
      });
    } else {
      const last = blocks[blocks.length - 1];
      if (para.length === 0 && indent >= 2 && last?.kind === "li") {
        last.text = `${last.text} ${text}`;
      } else {
        para.push(text);
      }
    }
  }
  flush();
  return blocks.filter((b) => b.text.length > 0);
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
