// End-to-end flash against the in-memory fake STM32. connectToFakeDevice
// returns a real DfuseDevice wired to FakeDfuseTransport, so these tests
// drive the exact do_download / do_download_multi code paths the Programmer
// uses on hardware — erase, set-address, program chunks, manifest — with no
// USB stack involved.
//
// The properties under test are the project-specific DFU behaviours CLAUDE.md
// says must not break: the per-sector erase dedup in do_download_multi and
// the STM32H7 bank-2 start-address nudge.

import { describe, expect, test } from "vitest";
import { DFUSE_COMMAND, type DfuseDevice } from "./dfuse";
import { connectToFakeDevice } from "./fake-device";

// High speed scales the fake's DNBUSY windows down to ~1ms so the full
// erase/program/manifest handshake still happens, just without the wait.
const SPEED = 100_000;
const XFER = 1024;

const firmware = (bytes: number): ArrayBuffer => {
  const buf = new ArrayBuffer(bytes);
  new Uint8Array(buf).fill(0xab);
  return buf;
};

interface DfuseCall {
  command: number;
  param: number;
}

// Record every DfuSe sub-command the device issues. SET_ADDRESS and
// ERASE_SECTOR carry the address as their param, which is all the assertions
// below need.
const spyOnCommands = (device: DfuseDevice): DfuseCall[] => {
  const calls: DfuseCall[] = [];
  const original = device.dfuseCommand.bind(device);
  device.dfuseCommand = async (command, param = 0, len = 1) => {
    calls.push({ command, param });
    return original(command, param, len);
  };
  return calls;
};

const erases = (calls: DfuseCall[]): number[] =>
  calls
    .filter((c) => c.command === DFUSE_COMMAND.ERASE_SECTOR)
    .map((c) => c.param);

describe("single-image flash (do_download)", () => {
  test("flashes an image inside one sector: one erase, chunked program, manifest", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    const calls = spyOnCommands(device);
    const progress: Array<[number, number | undefined]> = [];
    device.logger = { progress: (done, total) => progress.push([done, total]) };

    const image = firmware(8 * 1024);
    await device.do_download(XFER, image, true);

    // Default memory map is 128KB sectors from 0x08000000: an 8KB image
    // needs exactly one erase, at the sector base.
    expect(erases(calls)).toEqual([0x08000000]);

    // Program phase: a SET_ADDRESS per chunk, walking up in xfer-size steps.
    const sets = calls
      .filter((c) => c.command === DFUSE_COMMAND.SET_ADDRESS)
      .map((c) => c.param);
    // Last SET_ADDRESS is the manifest pointing back at the start.
    expect(sets.at(-1)).toBe(0x08000000);
    expect(sets.slice(0, -1)).toEqual(
      Array.from({ length: 8 }, (_, i) => 0x08000000 + i * XFER),
    );

    // Progress reached exactly the image size.
    const installDone = progress.filter(([, total]) => total === image.byteLength);
    expect(installDone.at(-1)?.[0]).toBe(image.byteLength);
  });

  test("an image spanning a sector boundary erases both sectors", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    const calls = spyOnCommands(device);
    device.logger = {};

    // 130KB: 128KB fills sector 0, 2KB spills into sector 1.
    await device.do_download(XFER, firmware(130 * 1024), true);

    expect(erases(calls)).toEqual([0x08000000, 0x08020000]);
  });
});

describe("multi-segment flash (do_download_multi)", () => {
  test("erases each sector once even when segments share it", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    const calls = spyOnCommands(device);
    device.logger = {};

    // Both segments live in the 0x08000000 sector. The dedup exists because
    // a repeated 128KB sector erase costs 1-2s each on real hardware.
    await device.do_download_multi(
      XFER,
      [
        { address: 0x08000000, buffer: firmware(4 * 1024) },
        { address: 0x08001000, buffer: firmware(4 * 1024) },
      ],
      true,
    );

    expect(erases(calls)).toEqual([0x08000000]);
  });

  test("disjoint segments erase their own sectors, once each", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    const calls = spyOnCommands(device);
    device.logger = {};

    await device.do_download_multi(
      XFER,
      [
        { address: 0x08000000, buffer: firmware(2 * 1024) },
        // Spans the sector-2/sector-3 boundary.
        { address: 0x0805f000, buffer: firmware(8 * 1024) },
      ],
      true,
    );

    expect(erases(calls)).toEqual([0x08000000, 0x08040000, 0x08060000]);
  });

  test("reports progress against the total across all segments", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    const progress: Array<[number, number | undefined]> = [];
    device.logger = { progress: (done, total) => progress.push([done, total]) };

    const segs = [
      { address: 0x08000000, buffer: firmware(3 * 1024) },
      { address: 0x08020000, buffer: firmware(5 * 1024) },
    ];
    await device.do_download_multi(XFER, segs, true);

    const total = 8 * 1024;
    const install = progress.filter(([, t]) => t === total).map(([d]) => d);
    expect(install.at(-1)).toBe(total);
    // Monotonic: the bar never moves backwards mid-flash.
    expect([...install].sort((a, b) => a - b)).toEqual(install);
  });

  test("rejects an empty segment list", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    await expect(device.do_download_multi(XFER, [], true)).rejects.toThrow(
      "No segments",
    );
  });
});

describe("STM32H7 bank-2 nudge", () => {
  test("a memory map starting at 0x90000000 gets nudged to 0x90040000", async () => {
    const { device } = await connectToFakeDevice({
      speed: SPEED,
      memoryDescriptor: "@External Flash /0x90000000/8*128Kg",
    });

    expect(device.startAddress).toBe(0x90040000);
  });

  test("the default map is not nudged", async () => {
    const { device } = await connectToFakeDevice({ speed: SPEED });
    expect(device.startAddress).toBe(0x08000000);
  });

  test("an explicit startAddress option wins over the nudge", async () => {
    const { device } = await connectToFakeDevice({
      speed: SPEED,
      memoryDescriptor: "@External Flash /0x90000000/8*128Kg",
      startAddress: 0x90000000,
    });

    expect(device.startAddress).toBe(0x90000000);
  });
});
