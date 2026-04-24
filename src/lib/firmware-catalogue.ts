import type { FirmwareSource } from "@/data/sources";
import { isHexPath, parseIntelHex, type FirmwareSegment } from "./dfu";

interface RawFirmware {
  id: number;
  name: string;
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
        const filename = r.filepath.replace(/^\.\//, "");
        return {
          id: r.id,
          name: r.name,
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

  return lists
    .flat()
    .sort((a, b) =>
      a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1,
    );
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
