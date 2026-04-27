// DfuSe (ST Microelectronics extension to DFU 1.1). Ported from dfu/dfuse.js,
// including the project-specific do_download_multi method that flashes several
// { address, buffer } segments with a single manifestation at the end. Erase
// is deduplicated per-sector so overlapping segments (e.g. STM32H7 bank-1/2
// tail) don't re-erase the same sector — each sector erase costs ~1-2s.

import {
  DFU_STATE,
  DFU_STATUS_OK,
  DfuDevice,
  type DfuInterfaceSettings,
  type DfuStatus,
} from "./dfu";
import type { UsbTransport } from "./transport";

export const DFUSE_COMMAND = {
  GET_COMMANDS: 0x00,
  SET_ADDRESS: 0x21,
  ERASE_SECTOR: 0x41,
} as const;

export interface MemorySegment {
  start: number;
  end: number;
  sectorSize: number;
  readable: boolean;
  erasable: boolean;
  writable: boolean;
}

export interface MemoryInfo {
  name: string;
  segments: MemorySegment[];
}

export interface FirmwareSegment {
  address: number;
  buffer: ArrayBuffer;
}

export const parseMemoryDescriptor = (desc: string): MemoryInfo => {
  const nameEndIndex = desc.indexOf("/");
  if (!desc.startsWith("@") || nameEndIndex === -1) {
    throw new Error(`Not a DfuSe memory descriptor: "${desc}"`);
  }

  const name = desc.substring(1, nameEndIndex).trim();
  const segmentString = desc.substring(nameEndIndex);
  const segments: MemorySegment[] = [];

  const sectorMultipliers: Record<string, number> = {
    " ": 1,
    B: 1,
    K: 1024,
    M: 1048576,
  };

  const contiguousSegmentRegex =
    /\/\s*(0x[0-9a-fA-F]{1,8})\s*\/(\s*[0-9]+\s*\*\s*[0-9]+\s?[ BKM]\s*[abcdefg]\s*,?\s*)+/g;
  let contiguousSegmentMatch: RegExpExecArray | null;
  while (
    (contiguousSegmentMatch = contiguousSegmentRegex.exec(segmentString))
  ) {
    const segmentRegex =
      /([0-9]+)\s*\*\s*([0-9]+)\s?([ BKM])\s*([abcdefg])\s*,?\s*/g;
    let startAddress = parseInt(contiguousSegmentMatch[1]!, 16);
    let segmentMatch: RegExpExecArray | null;
    while ((segmentMatch = segmentRegex.exec(contiguousSegmentMatch[0]))) {
      const sectorCount = parseInt(segmentMatch[1]!, 10);
      const sectorSize =
        parseInt(segmentMatch[2]!, 10) *
        (sectorMultipliers[segmentMatch[3]!] ?? 1);
      const properties =
        segmentMatch[4]!.charCodeAt(0) - "a".charCodeAt(0) + 1;
      segments.push({
        start: startAddress,
        sectorSize,
        end: startAddress + sectorSize * sectorCount,
        readable: (properties & 0x1) !== 0,
        erasable: (properties & 0x2) !== 0,
        writable: (properties & 0x4) !== 0,
      });
      startAddress += sectorSize * sectorCount;
    }
  }

  return { name, segments };
};

export class DfuseDevice extends DfuDevice {
  memoryInfo: MemoryInfo | null = null;
  startAddress: number = NaN;

  constructor(device: UsbTransport, settings: DfuInterfaceSettings) {
    super(device, settings);
    if (settings.name) {
      this.memoryInfo = parseMemoryDescriptor(settings.name);
    }
  }

  async dfuseCommand(command: number, param = 0x00, len = 1): Promise<void> {
    const commandNames: Record<number, string> = {
      0x00: "GET_COMMANDS",
      0x21: "SET_ADDRESS",
      0x41: "ERASE_SECTOR",
    };

    const payload = new ArrayBuffer(len + 1);
    const view = new DataView(payload);
    view.setUint8(0, command);
    if (len === 1) {
      view.setUint8(1, param);
    } else if (len === 4) {
      view.setUint32(1, param, true);
    } else {
      throw new Error(`Don't know how to handle data of len ${len}`);
    }

    try {
      await this.download(payload, 0);
    } catch (error) {
      throw new Error(
        `Error during special DfuSe command ${commandNames[command]}: ${String(error)}`,
      );
    }

    const status = await this.poll_until(
      (state) => state !== DFU_STATE.dfuDNBUSY,
    );
    if (status.status !== DFU_STATUS_OK) {
      throw new Error(
        `Special DfuSe command ${commandNames[command]} failed`,
      );
    }
  }

  getSegment(addr: number): MemorySegment | null {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error("No memory map information available");
    }
    for (const segment of this.memoryInfo.segments) {
      if (segment.start <= addr && addr < segment.end) {
        return segment;
      }
    }
    return null;
  }

  getSectorStart(addr: number, segment?: MemorySegment | null): number {
    const seg = segment ?? this.getSegment(addr);
    if (!seg) {
      throw new Error(`Address ${addr.toString(16)} outside of memory map`);
    }
    const sectorIndex = Math.floor((addr - seg.start) / seg.sectorSize);
    return seg.start + sectorIndex * seg.sectorSize;
  }

  getSectorEnd(addr: number, segment?: MemorySegment | null): number {
    const seg = segment ?? this.getSegment(addr);
    if (!seg) {
      throw new Error(`Address ${addr.toString(16)} outside of memory map`);
    }
    const sectorIndex = Math.floor((addr - seg.start) / seg.sectorSize);
    return seg.start + (sectorIndex + 1) * seg.sectorSize;
  }

  getFirstWritableSegment(): MemorySegment | null {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error("No memory map information available");
    }
    for (const segment of this.memoryInfo.segments) {
      if (segment.writable) return segment;
    }
    return null;
  }

  getMaxReadSize(startAddr: number): number {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error("No memory map information available");
    }

    let numBytes = 0;
    for (const segment of this.memoryInfo.segments) {
      if (segment.start <= startAddr && startAddr < segment.end) {
        if (segment.readable) {
          numBytes += segment.end - startAddr;
        } else {
          return 0;
        }
      } else if (segment.start === startAddr + numBytes) {
        if (segment.readable) {
          numBytes += segment.end - segment.start;
        } else {
          break;
        }
      }
    }
    return numBytes;
  }

  async erase(startAddr: number, length: number): Promise<void> {
    let segment = this.getSegment(startAddr);
    let addr = this.getSectorStart(startAddr, segment);
    const endAddr = this.getSectorEnd(startAddr + length - 1);

    let bytesErased = 0;
    const bytesToErase = endAddr - addr;
    if (bytesToErase > 0) {
      this["logProgress"](bytesErased, bytesToErase);
    }

    while (addr < endAddr) {
      if (!segment || segment.end <= addr) {
        segment = this.getSegment(addr);
      }
      if (!segment) {
        throw new Error(`Address ${addr.toString(16)} outside of memory map`);
      }
      if (!segment.erasable) {
        bytesErased = Math.min(bytesErased + segment.end - addr, bytesToErase);
        addr = segment.end;
        this["logProgress"](bytesErased, bytesToErase);
        continue;
      }
      const sectorIndex = Math.floor(
        (addr - segment.start) / segment.sectorSize,
      );
      const sectorAddr = segment.start + sectorIndex * segment.sectorSize;
      await this.dfuseCommand(DFUSE_COMMAND.ERASE_SECTOR, sectorAddr, 4);
      addr = sectorAddr + segment.sectorSize;
      bytesErased += segment.sectorSize;
      this["logProgress"](bytesErased, bytesToErase);
    }
  }

  override async do_download(
    xfer_size: number,
    data: ArrayBuffer,
    _manifestationTolerant: boolean,
  ): Promise<void> {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error("No memory map available");
    }
    this["logInfo"]("Preparing...");

    let bytes_sent = 0;
    const expected_size = data.byteLength;

    let startAddress = this.startAddress;
    if (isNaN(startAddress)) {
      startAddress = this.memoryInfo.segments[0]!.start;
      this["logWarning"](
        `Using inferred start address 0x${startAddress.toString(16)}`,
      );
    } else if (this.getSegment(startAddress) === null) {
      this["logError"](
        `Start address 0x${startAddress.toString(16)} outside of memory map bounds`,
      );
    }
    await this.erase(startAddress, expected_size);

    this["logInfo"]("Installing...");

    let address = startAddress;
    while (bytes_sent < expected_size) {
      const bytes_left = expected_size - bytes_sent;
      const chunk_size = Math.min(bytes_left, xfer_size);

      let bytes_written = 0;
      let dfu_status: DfuStatus;
      try {
        await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, address, 4);
        bytes_written = await this.download(
          data.slice(bytes_sent, bytes_sent + chunk_size),
          2,
        );
        dfu_status = await this.poll_until_idle(DFU_STATE.dfuDNLOAD_IDLE);
        address += chunk_size;
      } catch (error) {
        throw new Error(`Error during DfuSe download: ${String(error)}`);
      }

      if (dfu_status.status !== DFU_STATUS_OK) {
        throw new Error(
          `DFU DOWNLOAD failed state=${dfu_status.state}, status=${dfu_status.status}`,
        );
      }

      bytes_sent += bytes_written;
      this["logProgress"](bytes_sent, expected_size);
    }

    try {
      await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, startAddress, 4);
      await this.download(new ArrayBuffer(0), 0);
    } catch (error) {
      throw new Error(`Error during DfuSe manifestation: ${String(error)}`);
    }

    try {
      await this.poll_until((state) => state === DFU_STATE.dfuMANIFEST);
    } catch (error) {
      this["logError"](String(error));
    }
  }

  async do_download_multi(
    xfer_size: number,
    segments: FirmwareSegment[],
    _manifestationTolerant: boolean,
  ): Promise<void> {
    if (!this.memoryInfo || !this.memoryInfo.segments) {
      throw new Error("No memory map available");
    }
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error("No segments to flash");
    }

    this["logInfo"]("Preparing...");

    const totalSize = segments.reduce(
      (sum, seg) => sum + seg.buffer.byteLength,
      0,
    );
    let totalBytesSent = 0;

    // Erase only unique sector starts so overlapping segments don't double-erase.
    const erasedSectorStarts = new Set<number>();
    for (const seg of segments) {
      const memSegment = this.getSegment(seg.address);
      if (memSegment === null) {
        this["logError"](
          `Segment address 0x${seg.address.toString(16)} outside of memory map bounds`,
        );
        continue;
      }
      const sectorStart = this.getSectorStart(seg.address, memSegment);
      const sectorEnd = this.getSectorEnd(
        seg.address + seg.buffer.byteLength - 1,
      );
      const sectorStep = memSegment.sectorSize || 0x20000;
      let addr = sectorStart;
      while (addr < sectorEnd) {
        if (!erasedSectorStarts.has(addr)) {
          erasedSectorStarts.add(addr);
          await this.erase(addr, 1);
        }
        addr += sectorStep;
      }
    }

    this["logInfo"]("Installing...");

    for (const seg of segments) {
      const expected_size = seg.buffer.byteLength;
      let bytes_sent = 0;
      let address = seg.address;

      while (bytes_sent < expected_size) {
        const bytes_left = expected_size - bytes_sent;
        const chunk_size = Math.min(bytes_left, xfer_size);

        let bytes_written = 0;
        let dfu_status: DfuStatus;
        try {
          await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, address, 4);
          bytes_written = await this.download(
            seg.buffer.slice(bytes_sent, bytes_sent + chunk_size),
            2,
          );
          dfu_status = await this.poll_until_idle(DFU_STATE.dfuDNLOAD_IDLE);
          address += chunk_size;
        } catch (error) {
          throw new Error(`Error during DfuSe download: ${String(error)}`);
        }

        if (dfu_status.status !== DFU_STATUS_OK) {
          throw new Error(
            `DFU DOWNLOAD failed state=${dfu_status.state}, status=${dfu_status.status}`,
          );
        }

        bytes_sent += bytes_written;
        totalBytesSent += bytes_written;
        this["logProgress"](totalBytesSent, totalSize);
      }
    }

    try {
      await this.dfuseCommand(
        DFUSE_COMMAND.SET_ADDRESS,
        segments[0]!.address,
        4,
      );
      await this.download(new ArrayBuffer(0), 0);
    } catch (error) {
      throw new Error(`Error during DfuSe manifestation: ${String(error)}`);
    }

    try {
      await this.poll_until((state) => state === DFU_STATE.dfuMANIFEST);
    } catch (error) {
      this["logError"](String(error));
    }
  }

  override async do_upload(
    xfer_size: number,
    max_size: number = Infinity,
  ): Promise<Blob> {
    let startAddress = this.startAddress;
    if (isNaN(startAddress)) {
      if (!this.memoryInfo) {
        throw new Error("No memory map available");
      }
      startAddress = this.memoryInfo.segments[0]!.start;
      this["logWarning"](
        `Using inferred start address 0x${startAddress.toString(16)}`,
      );
    } else if (this.getSegment(startAddress) === null) {
      this["logWarning"](
        `Start address 0x${startAddress.toString(16)} outside of memory map bounds`,
      );
    }

    this["logInfo"](
      `Reading up to 0x${max_size.toString(16)} bytes starting at 0x${startAddress.toString(16)}`,
    );
    const state = await this.getState();
    if (state !== DFU_STATE.dfuIDLE) {
      await this.abortToIdle();
    }
    await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, startAddress, 4);
    await this.abortToIdle();

    return super.do_upload(xfer_size, max_size, 2);
  }
}
