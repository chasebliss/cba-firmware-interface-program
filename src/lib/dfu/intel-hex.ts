import type { FirmwareSegment } from "./dfuse";

// Records are split into a new segment at any address gap, matching
// dfu-util behavior. This avoids writing huge 0xFF padding across firmware
// regions that sit far apart (e.g. STM32H7 bank 1 at 0x08000000 and bank 2
// at 0x08100000). Truly adjacent records still merge into one segment.
export const parseIntelHex = (text: string): FirmwareSegment[] => {
  interface Record {
    address: number;
    bytes: Uint8Array;
  }

  const records: Record[] = [];
  let upperAddr = 0;
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === "" || line[0] !== ":") continue;
    if (line.length < 11) {
      throw new Error(`Hex line ${i + 1} too short: ${line}`);
    }

    const byteCount = parseInt(line.substring(1, 3), 16);
    const offset = parseInt(line.substring(3, 7), 16);
    const recordType = parseInt(line.substring(7, 9), 16);
    const dataStart = 9;
    const dataEnd = dataStart + byteCount * 2;
    if (line.length < dataEnd + 2) {
      throw new Error(`Hex line ${i + 1} truncated`);
    }
    const data = new Uint8Array(byteCount);
    for (let j = 0; j < byteCount; j++) {
      data[j] = parseInt(
        line.substring(dataStart + j * 2, dataStart + j * 2 + 2),
        16,
      );
    }

    if (recordType === 0x00) {
      records.push({
        address: ((upperAddr << 16) | offset) >>> 0,
        bytes: data,
      });
    } else if (recordType === 0x01) {
      break;
    } else if (recordType === 0x04) {
      upperAddr = (data[0]! << 8) | data[1]!;
    } else if (recordType === 0x02) {
      upperAddr = (((data[0]! << 8) | data[1]!) << 4) >>> 16;
    }
    // record types 0x03 and 0x05 (start addresses) are informational for DFU
  }

  if (records.length === 0) {
    throw new Error("Hex file contained no data records");
  }

  records.sort((a, b) => a.address - b.address);

  interface Group {
    start: number;
    end: number;
    records: Record[];
  }

  const groups: Group[] = [];
  let group: Group | null = null;
  for (const rec of records) {
    const end = rec.address + rec.bytes.length;
    if (!group || rec.address > group.end) {
      group = { start: rec.address, end, records: [rec] };
      groups.push(group);
    } else {
      group.end = Math.max(group.end, end);
      group.records.push(rec);
    }
  }

  return groups.map((g) => {
    const buf = new Uint8Array(g.end - g.start).fill(0xff);
    for (const r of g.records) {
      buf.set(r.bytes, r.address - g.start);
    }
    return { address: g.start, buffer: buf.buffer as ArrayBuffer };
  });
};

export const isHexPath = (pathOrName: string): boolean =>
  /\.hex(\?|#|$)/i.test(pathOrName);
