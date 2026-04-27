// In-memory fake of a DfuSe-capable STM32 device. Implements UsbTransport at
// the granularity DfuDevice/DfuseDevice consume: control transfers carrying
// DFU class requests + DfuSe sub-commands, plus a state machine matching the
// DFU 1.1 / DfuSe 1.1a flow (idle → DNBUSY → DNLOAD_IDLE → MANIFEST). No
// descriptor parsing — connectToFakeDevice constructs a DfuseDevice directly
// with a hand-rolled memory descriptor, skipping the GET_DESCRIPTOR path.

import {
  DFU_REQUEST,
  DFU_STATE,
  DFU_STATUS_OK,
  type DfuDeviceProperties,
  type DfuInterfaceSettings,
} from "./dfu";
import { DFUSE_COMMAND, DfuseDevice } from "./dfuse";
import type { UsbTransport } from "./transport";

interface FakeOptions {
  // Memory descriptor string. Defaults to a 1MB STM32 main flash region with
  // 128KB sectors, which exercises the full DfuSe download path (erase per
  // sector → set address → program → manifest). Override for bank-2 nudge
  // testing (start at 0x90000000) or other layouts.
  memoryDescriptor?: string;
  // 1 = roughly real-hardware timing (~1.5s/sector erase). Higher = faster.
  speed?: number;
  // Force the first writable segment used as start address. If omitted, the
  // DfuseDevice picks getFirstWritableSegment() (with the 0x90000000 nudge).
  startAddress?: number;
}

const DEFAULT_MEMORY = "@Internal Flash /0x08000000/8*128Kg";
const DEFAULT_SPEED = 4;
const REAL_ERASE_MS_PER_SECTOR = 1500;
const REAL_PROGRAM_MS_PER_KB = 8;
const SET_ADDRESS_MS = 5;

export class FakeDfuseTransport implements UsbTransport {
  private opened = false;
  private currentConfigValue: number | null = null;
  private claimedInterfaces = new Set<number>();
  private currentAlternates = new Map<number, number>();

  // DFU state machine
  private state: number = DFU_STATE.dfuIDLE;
  private status: number = DFU_STATUS_OK;
  private busyUntil = 0;
  private nextStateAfterBusy: number = DFU_STATE.dfuIDLE;
  private pollTimeout = 0;

  private currentAddress = 0;
  private bytesProgrammedSinceManifest = 0;
  private speed: number;

  // Mirrors USBDevice.configurations enough to satisfy DfuDevice.open().
  configurations: USBConfiguration[];

  constructor(speed: number) {
    this.speed = speed;
    this.configurations = [makeFakeUsbConfiguration()];
  }

  get configuration(): USBConfiguration | null {
    if (this.currentConfigValue === null) return null;
    return (
      this.configurations.find(
        (c) => c.configurationValue === this.currentConfigValue,
      ) ?? null
    );
  }

  async open(): Promise<void> {
    this.opened = true;
  }

  async close(): Promise<void> {
    this.opened = false;
    this.claimedInterfaces.clear();
  }

  async selectConfiguration(configurationValue: number): Promise<void> {
    this.currentConfigValue = configurationValue;
  }

  async claimInterface(interfaceNumber: number): Promise<void> {
    this.claimedInterfaces.add(interfaceNumber);
    const config = this.configuration;
    const intf = config?.interfaces[interfaceNumber];
    if (intf) (intf as { claimed: boolean }).claimed = true;
  }

  async selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number,
  ): Promise<void> {
    this.currentAlternates.set(interfaceNumber, alternateSetting);
    const config = this.configuration;
    const intf = config?.interfaces[interfaceNumber];
    if (intf) {
      const alt = intf.alternates.find(
        (a) => a.alternateSetting === alternateSetting,
      );
      if (alt) (intf as { alternate: USBAlternateInterface }).alternate = alt;
    }
  }

  async reset(): Promise<void> {
    this.state = DFU_STATE.dfuIDLE;
    this.status = DFU_STATUS_OK;
    this.busyUntil = 0;
  }

  async controlTransferIn(
    setup: USBControlTransferParameters,
    length: number,
  ): Promise<USBInTransferResult> {
    if (!this.opened) {
      return { status: "stall", data: undefined };
    }

    if (setup.requestType === "class" && setup.recipient === "interface") {
      return this.handleClassIn(setup, length);
    }

    // Standard / vendor reads — the DfuSe download path doesn't issue any once
    // the device is connected, so a stall here means the caller went off the
    // happy path (e.g. tried to read a string descriptor).
    return { status: "stall", data: undefined };
  }

  async controlTransferOut(
    setup: USBControlTransferParameters,
    data?: BufferSource,
  ): Promise<USBOutTransferResult> {
    if (!this.opened) {
      return { status: "stall", bytesWritten: 0 };
    }

    if (setup.requestType === "class" && setup.recipient === "interface") {
      return this.handleClassOut(setup, data);
    }

    return { status: "stall", bytesWritten: 0 };
  }

  private resolveBusy(): void {
    if (this.busyUntil > 0 && performance.now() >= this.busyUntil) {
      this.state = this.nextStateAfterBusy;
      this.busyUntil = 0;
      this.pollTimeout = 0;
    }
  }

  private remainingBusyMs(): number {
    if (this.busyUntil === 0) return 0;
    return Math.max(0, Math.ceil(this.busyUntil - performance.now()));
  }

  private enterBusy(durationMs: number, nextState: number): void {
    const scaled = Math.max(1, Math.round(durationMs / this.speed));
    this.busyUntil = performance.now() + scaled;
    this.pollTimeout = scaled;
    this.state = DFU_STATE.dfuDNBUSY;
    this.nextStateAfterBusy = nextState;
  }

  private handleClassIn(
    setup: USBControlTransferParameters,
    length: number,
  ): USBInTransferResult {
    this.resolveBusy();

    if (setup.request === DFU_REQUEST.GETSTATUS) {
      const buffer = new ArrayBuffer(6);
      const view = new DataView(buffer);
      const remaining = this.remainingBusyMs();
      view.setUint8(0, this.status);
      // pollTimeout is a 24-bit little-endian value in bytes 1-3.
      const reportedTimeout = remaining > 0 ? remaining : this.pollTimeout;
      view.setUint8(1, reportedTimeout & 0xff);
      view.setUint8(2, (reportedTimeout >> 8) & 0xff);
      view.setUint8(3, (reportedTimeout >> 16) & 0xff);
      view.setUint8(4, this.state);
      view.setUint8(5, 0);
      return { status: "ok", data: new DataView(buffer.slice(0, length)) };
    }

    if (setup.request === DFU_REQUEST.GETSTATE) {
      const buffer = new ArrayBuffer(1);
      new DataView(buffer).setUint8(0, this.state);
      return { status: "ok", data: new DataView(buffer.slice(0, length)) };
    }

    return { status: "stall", data: undefined };
  }

  private handleClassOut(
    setup: USBControlTransferParameters,
    data?: BufferSource,
  ): USBOutTransferResult {
    this.resolveBusy();

    if (setup.request === DFU_REQUEST.CLRSTATUS) {
      this.state = DFU_STATE.dfuIDLE;
      this.status = DFU_STATUS_OK;
      this.busyUntil = 0;
      return { status: "ok", bytesWritten: 0 };
    }

    if (setup.request === DFU_REQUEST.ABORT) {
      this.state = DFU_STATE.dfuIDLE;
      this.busyUntil = 0;
      return { status: "ok", bytesWritten: 0 };
    }

    if (setup.request === DFU_REQUEST.DNLOAD) {
      return this.handleDnload(setup.value ?? 0, data);
    }

    if (setup.request === DFU_REQUEST.DETACH) {
      return { status: "ok", bytesWritten: 0 };
    }

    return { status: "stall", bytesWritten: 0 };
  }

  private handleDnload(
    blockNum: number,
    data?: BufferSource,
  ): USBOutTransferResult {
    const view = bufferSourceToUint8(data);
    const length = view?.byteLength ?? 0;

    // blockNum 0 with payload → DfuSe sub-command. Empty blockNum 0 → manifest
    // start. blockNum ≥ 2 → program data at currentAddress (which was set by
    // a prior SET_ADDRESS sub-command).
    if (blockNum === 0) {
      if (!view || length === 0) {
        this.state = DFU_STATE.dfuMANIFEST;
        this.busyUntil = 0;
        return { status: "ok", bytesWritten: 0 };
      }

      const command = view[0]!;
      if (command === DFUSE_COMMAND.SET_ADDRESS && length >= 5) {
        this.currentAddress = readUint32LE(view, 1);
        this.enterBusy(SET_ADDRESS_MS, DFU_STATE.dfuDNLOAD_IDLE);
        return { status: "ok", bytesWritten: length };
      }
      if (command === DFUSE_COMMAND.ERASE_SECTOR && length >= 5) {
        // Real STM32 sector erase ranges from ~500ms (small sectors) to a few
        // seconds (128KB). Fixed-ish at 1.5s here; speed knob scales it.
        this.enterBusy(REAL_ERASE_MS_PER_SECTOR, DFU_STATE.dfuDNLOAD_IDLE);
        return { status: "ok", bytesWritten: length };
      }
      if (command === DFUSE_COMMAND.GET_COMMANDS) {
        this.enterBusy(SET_ADDRESS_MS, DFU_STATE.dfuDNLOAD_IDLE);
        return { status: "ok", bytesWritten: length };
      }
      // Unknown sub-command — go to error so the caller sees a real failure.
      this.state = DFU_STATE.dfuERROR;
      this.status = 0x0f; // errUNKNOWN
      return { status: "ok", bytesWritten: length };
    }

    // Program data at currentAddress. Match real-ish timing per chunk so the
    // progress bar moves at a believable rate.
    const programMs = Math.max(1, (length / 1024) * REAL_PROGRAM_MS_PER_KB);
    this.bytesProgrammedSinceManifest += length;
    this.currentAddress += length;
    this.enterBusy(programMs, DFU_STATE.dfuDNLOAD_IDLE);
    return { status: "ok", bytesWritten: length };
  }
}

const bufferSourceToUint8 = (
  data: BufferSource | undefined,
): Uint8Array | undefined => {
  if (!data) return undefined;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};

const readUint32LE = (view: Uint8Array, offset: number): number => {
  return (
    view[offset]! |
    (view[offset + 1]! << 8) |
    (view[offset + 2]! << 16) |
    (view[offset + 3]! << 24)
  );
};

// Hand-rolled USBConfiguration shape. DfuDevice.open() touches
// .configurationValue, .interfaces[n].claimed, and .interfaces[n].alternate.
const makeFakeUsbConfiguration = (): USBConfiguration => {
  const alternate: USBAlternateInterface = {
    alternateSetting: 0,
    interfaceClass: 0xfe,
    interfaceSubclass: 0x01,
    interfaceProtocol: 0x02, // DfuSe
    interfaceName: "Fake DfuSe",
    endpoints: [],
  };
  const intf = {
    interfaceNumber: 0,
    alternate,
    alternates: [alternate],
    claimed: false,
  } as unknown as USBInterface;
  return {
    configurationValue: 1,
    configurationName: "fake",
    interfaces: [intf],
  };
};

const makeFakeSettings = (memoryDescriptor: string): DfuInterfaceSettings => {
  const config = makeFakeUsbConfiguration();
  return {
    configuration: config,
    interface: config.interfaces[0]!,
    alternate: config.interfaces[0]!.alternates[0]!,
    name: memoryDescriptor,
  };
};

export interface FakeConnectResult {
  device: DfuseDevice;
  properties: Partial<DfuDeviceProperties>;
}

export const connectToFakeDevice = async (
  options: FakeOptions = {},
): Promise<FakeConnectResult> => {
  const speed = options.speed ?? DEFAULT_SPEED;
  const memory = options.memoryDescriptor ?? DEFAULT_MEMORY;

  const transport = new FakeDfuseTransport(speed);
  const settings = makeFakeSettings(memory);
  const device = new DfuseDevice(transport, settings);

  // Mirror the bank-2 nudge from openDevice() so behaviour matches the real
  // connect path even though we're skipping descriptor parsing.
  if (device.memoryInfo) {
    const segment = device.getFirstWritableSegment();
    if (segment) {
      if (segment.start === 0x90000000) segment.start += 0x40000;
      device.startAddress = options.startAddress ?? segment.start;
    }
  }

  const properties: Partial<DfuDeviceProperties> = {
    WillDetach: false,
    ManifestationTolerant: true,
    CanUpload: true,
    CanDnload: true,
    TransferSize: 1024,
    DetachTimeOut: 250,
    DFUVersion: 0x011a,
  };
  device.properties = properties as DfuDeviceProperties;

  // Bypass DfuDevice.open() / descriptor reads. The fake transport is already
  // in a flashable state — but DfuDevice.open() is what selects config /
  // claims interface, and Programmer.tsx calls device.getStatus() before
  // download, which goes through requestIn → controlTransferIn. We need to be
  // marked open so handleClassIn responds.
  await device.open();

  return { device, properties };
};
