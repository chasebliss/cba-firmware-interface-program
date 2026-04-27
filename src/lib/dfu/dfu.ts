// USB DFU 1.1 core. Ported from the original app's dfu/dfu.js — byte flow is
// preserved exactly. UI concerns (logging, progress rendering) are passed in
// as a logger interface; nothing in here touches the DOM.

import type { UsbTransport } from "./transport";

export const DFU_REQUEST = {
  DETACH: 0x00,
  DNLOAD: 0x01,
  UPLOAD: 0x02,
  GETSTATUS: 0x03,
  CLRSTATUS: 0x04,
  GETSTATE: 0x05,
  ABORT: 0x06,
} as const;

export const DFU_STATE = {
  appIDLE: 0,
  appDETACH: 1,
  dfuIDLE: 2,
  dfuDNLOAD_SYNC: 3,
  dfuDNBUSY: 4,
  dfuDNLOAD_IDLE: 5,
  dfuMANIFEST_SYNC: 6,
  dfuMANIFEST: 7,
  dfuMANIFEST_WAIT_RESET: 8,
  dfuUPLOAD_IDLE: 9,
  dfuERROR: 10,
} as const;

export type DfuState = (typeof DFU_STATE)[keyof typeof DFU_STATE];

export const DFU_STATUS_OK = 0x00;

export interface DfuStatus {
  status: number;
  pollTimeout: number;
  state: number;
}

export interface DfuLogger {
  debug?: (msg: string) => void;
  info?: (msg: string) => void;
  warning?: (msg: string) => void;
  error?: (msg: string) => void;
  progress?: (done: number, total?: number) => void;
}

export interface InterfaceDescriptor {
  bLength: number;
  bDescriptorType: number;
  bInterfaceNumber: number;
  bAlternateSetting: number;
  bNumEndpoints: number;
  bInterfaceClass: number;
  bInterfaceSubClass: number;
  bInterfaceProtocol: number;
  iInterface: number;
  descriptors: SubDescriptor[];
}

export interface DfuFunctionalDescriptor {
  bLength: number;
  bDescriptorType: number;
  bmAttributes: number;
  wDetachTimeOut: number;
  wTransferSize: number;
  bcdDFUVersion: number;
}

export interface GenericDescriptor {
  bLength: number;
  bDescriptorType: number;
  data: DataView;
}

export type SubDescriptor =
  | InterfaceDescriptor
  | DfuFunctionalDescriptor
  | GenericDescriptor;

export interface ConfigurationDescriptor {
  bLength: number;
  bDescriptorType: number;
  wTotalLength: number;
  bNumInterfaces: number;
  bConfigurationValue: number;
  iConfiguration: number;
  bmAttributes: number;
  bMaxPower: number;
  descriptors: SubDescriptor[];
}

export interface DfuInterfaceSettings {
  configuration: USBConfiguration;
  interface: USBInterface;
  alternate: USBAlternateInterface;
  name: string | null;
}

export interface DfuDeviceProperties {
  WillDetach: boolean;
  ManifestationTolerant: boolean;
  CanUpload: boolean;
  CanDnload: boolean;
  TransferSize: number;
  DetachTimeOut: number;
  DFUVersion: number;
}

export const findDeviceDfuInterfaces = (
  device: USBDevice,
): DfuInterfaceSettings[] => {
  const interfaces: DfuInterfaceSettings[] = [];
  for (const conf of device.configurations) {
    for (const intf of conf.interfaces) {
      for (const alt of intf.alternates) {
        if (
          alt.interfaceClass === 0xfe &&
          alt.interfaceSubclass === 0x01 &&
          (alt.interfaceProtocol === 0x01 || alt.interfaceProtocol === 0x02)
        ) {
          interfaces.push({
            configuration: conf,
            interface: intf,
            alternate: alt,
            name: alt.interfaceName ?? null,
          });
        }
      }
    }
  }
  return interfaces;
};

export const findAllDfuInterfaces = async (): Promise<DfuDevice[]> => {
  const devices = await navigator.usb.getDevices();
  const matches: DfuDevice[] = [];
  for (const device of devices) {
    for (const settings of findDeviceDfuInterfaces(device)) {
      matches.push(new DfuDevice(device, settings));
    }
  }
  return matches;
};

export const parseDeviceDescriptor = (data: DataView) => ({
  bLength: data.getUint8(0),
  bDescriptorType: data.getUint8(1),
  bcdUSB: data.getUint16(2, true),
  bDeviceClass: data.getUint8(4),
  bDeviceSubClass: data.getUint8(5),
  bDeviceProtocol: data.getUint8(6),
  bMaxPacketSize: data.getUint8(7),
  idVendor: data.getUint16(8, true),
  idProduct: data.getUint16(10, true),
  bcdDevice: data.getUint16(12, true),
  iManufacturer: data.getUint8(14),
  iProduct: data.getUint8(15),
  iSerialNumber: data.getUint8(16),
  bNumConfigurations: data.getUint8(17),
});

export const parseConfigurationDescriptor = (
  data: DataView,
): ConfigurationDescriptor => {
  const descriptorData = new DataView(data.buffer.slice(9));
  const descriptors = parseSubDescriptors(descriptorData);
  return {
    bLength: data.getUint8(0),
    bDescriptorType: data.getUint8(1),
    wTotalLength: data.getUint16(2, true),
    bNumInterfaces: data.getUint8(4),
    bConfigurationValue: data.getUint8(5),
    iConfiguration: data.getUint8(6),
    bmAttributes: data.getUint8(7),
    bMaxPower: data.getUint8(8),
    descriptors,
  };
};

export const parseInterfaceDescriptor = (
  data: DataView,
): InterfaceDescriptor => ({
  bLength: data.getUint8(0),
  bDescriptorType: data.getUint8(1),
  bInterfaceNumber: data.getUint8(2),
  bAlternateSetting: data.getUint8(3),
  bNumEndpoints: data.getUint8(4),
  bInterfaceClass: data.getUint8(5),
  bInterfaceSubClass: data.getUint8(6),
  bInterfaceProtocol: data.getUint8(7),
  iInterface: data.getUint8(8),
  descriptors: [],
});

export const parseFunctionalDescriptor = (
  data: DataView,
): DfuFunctionalDescriptor => ({
  bLength: data.getUint8(0),
  bDescriptorType: data.getUint8(1),
  bmAttributes: data.getUint8(2),
  wDetachTimeOut: data.getUint16(3, true),
  wTransferSize: data.getUint16(5, true),
  bcdDFUVersion: data.getUint16(7, true),
});

export const parseSubDescriptors = (
  descriptorData: DataView,
): SubDescriptor[] => {
  const DT_INTERFACE = 4;
  const DT_DFU_FUNCTIONAL = 0x21;
  const USB_CLASS_APP_SPECIFIC = 0xfe;
  const USB_SUBCLASS_DFU = 0x01;

  let remainingData = descriptorData;
  const descriptors: SubDescriptor[] = [];
  let currIntf: InterfaceDescriptor | undefined;
  let inDfuIntf = false;

  while (remainingData.byteLength > 2) {
    const bLength = remainingData.getUint8(0);
    const bDescriptorType = remainingData.getUint8(1);
    const descData = new DataView(remainingData.buffer.slice(0, bLength));

    if (bDescriptorType === DT_INTERFACE) {
      currIntf = parseInterfaceDescriptor(descData);
      inDfuIntf =
        currIntf.bInterfaceClass === USB_CLASS_APP_SPECIFIC &&
        currIntf.bInterfaceSubClass === USB_SUBCLASS_DFU;
      descriptors.push(currIntf);
    } else if (inDfuIntf && bDescriptorType === DT_DFU_FUNCTIONAL) {
      const funcDesc = parseFunctionalDescriptor(descData);
      descriptors.push(funcDesc);
      currIntf?.descriptors.push(funcDesc);
    } else {
      const desc: GenericDescriptor = {
        bLength,
        bDescriptorType,
        data: descData,
      };
      descriptors.push(desc);
      currIntf?.descriptors.push(desc);
    }

    remainingData = new DataView(remainingData.buffer.slice(bLength));
  }

  return descriptors;
};

export class DfuDevice {
  device_: UsbTransport;
  settings: DfuInterfaceSettings;
  intfNumber: number;
  disconnected = false;
  logger: DfuLogger = {};
  properties?: DfuDeviceProperties;

  constructor(device: UsbTransport, settings: DfuInterfaceSettings) {
    this.device_ = device;
    this.settings = settings;
    this.intfNumber = settings.interface.interfaceNumber;
  }

  protected logDebug(msg: string): void {
    this.logger.debug?.(msg);
  }
  protected logInfo(msg: string): void {
    this.logger.info?.(msg);
  }
  protected logWarning(msg: string): void {
    this.logger.warning?.(msg);
  }
  protected logError(msg: string): void {
    this.logger.error?.(msg);
  }
  protected logProgress(done: number, total?: number): void {
    this.logger.progress?.(done, total);
  }

  async open(): Promise<void> {
    await this.device_.open();
    const confValue = this.settings.configuration.configurationValue;
    if (
      this.device_.configuration === null ||
      this.device_.configuration.configurationValue !== confValue
    ) {
      await this.device_.selectConfiguration(confValue);
    }

    const intfNumber = this.settings.interface.interfaceNumber;
    if (!this.device_.configuration!.interfaces[intfNumber]!.claimed) {
      await this.device_.claimInterface(intfNumber);
    }

    const altSetting = this.settings.alternate.alternateSetting;
    const intf = this.device_.configuration!.interfaces[intfNumber]!;
    if (
      intf.alternate === null ||
      intf.alternate.alternateSetting !== altSetting
    ) {
      await this.device_.selectAlternateInterface(intfNumber, altSetting);
    }
  }

  async close(): Promise<void> {
    try {
      await this.device_.close();
    } catch (error) {
      console.log(error);
    }
  }

  async readDeviceDescriptor(): Promise<DataView> {
    const GET_DESCRIPTOR = 0x06;
    const DT_DEVICE = 0x01;
    const wValue = DT_DEVICE << 8;

    const result = await this.device_.controlTransferIn(
      {
        requestType: "standard",
        recipient: "device",
        request: GET_DESCRIPTOR,
        value: wValue,
        index: 0,
      },
      18,
    );

    if (result.status !== "ok" || !result.data) {
      throw new Error(`readDeviceDescriptor failed: ${result.status}`);
    }
    return result.data;
  }

  async readStringDescriptor(
    index: number,
    langID = 0,
  ): Promise<string | number[]> {
    const GET_DESCRIPTOR = 0x06;
    const DT_STRING = 0x03;
    const wValue = (DT_STRING << 8) | index;

    const setup: USBControlTransferParameters = {
      requestType: "standard",
      recipient: "device",
      request: GET_DESCRIPTOR,
      value: wValue,
      index: langID,
    };

    let result = await this.device_.controlTransferIn(setup, 1);
    if (result.status === "ok" && result.data) {
      const bLength = result.data.getUint8(0);
      result = await this.device_.controlTransferIn(setup, bLength);
      if (result.status === "ok" && result.data) {
        const len = (bLength - 2) / 2;
        const u16_words: number[] = [];
        for (let i = 0; i < len; i++) {
          u16_words.push(result.data.getUint16(2 + i * 2, true));
        }
        if (langID === 0) {
          return u16_words;
        }
        return String.fromCharCode.apply(String, u16_words);
      }
    }

    throw new Error(`Failed to read string descriptor ${index}: ${result.status}`);
  }

  async readInterfaceNames(): Promise<
    Record<number, Record<number, Record<number, string | null>>>
  > {
    const DT_INTERFACE = 4;
    const configs: Record<
      number,
      Record<number, Record<number, number | string | null>>
    > = {};
    const allStringIndices = new Set<number>();

    for (
      let configIndex = 0;
      configIndex < this.device_.configurations.length;
      configIndex++
    ) {
      const rawConfig = await this.readConfigurationDescriptor(configIndex);
      const configDesc = parseConfigurationDescriptor(rawConfig);
      const configValue = configDesc.bConfigurationValue;
      configs[configValue] = {};

      for (const desc of configDesc.descriptors) {
        if (
          "bInterfaceNumber" in desc &&
          desc.bDescriptorType === DT_INTERFACE
        ) {
          if (!(desc.bInterfaceNumber in configs[configValue]!)) {
            configs[configValue]![desc.bInterfaceNumber] = {};
          }
          configs[configValue]![desc.bInterfaceNumber]![desc.bAlternateSetting] =
            desc.iInterface;
          if (desc.iInterface > 0) {
            allStringIndices.add(desc.iInterface);
          }
        }
      }
    }

    const strings: Record<number, string | null> = {};
    for (const index of allStringIndices) {
      try {
        const s = await this.readStringDescriptor(index, 0x0409);
        strings[index] = typeof s === "string" ? s : null;
      } catch (error) {
        console.log(error);
        strings[index] = null;
      }
    }

    const resolved: Record<
      number,
      Record<number, Record<number, string | null>>
    > = {};
    for (const configValue in configs) {
      resolved[configValue] = {};
      for (const intfNumber in configs[configValue]) {
        resolved[configValue]![intfNumber] = {};
        for (const alt in configs[configValue]![intfNumber]) {
          const iIndex = configs[configValue]![intfNumber]![alt] as number;
          resolved[configValue]![intfNumber]![alt] =
            iIndex > 0 ? (strings[iIndex] ?? null) : null;
        }
      }
    }

    return resolved;
  }

  async readConfigurationDescriptor(index: number): Promise<DataView> {
    const GET_DESCRIPTOR = 0x06;
    const DT_CONFIGURATION = 0x02;
    const wValue = (DT_CONFIGURATION << 8) | index;

    const firstResult = await this.device_.controlTransferIn(
      {
        requestType: "standard",
        recipient: "device",
        request: GET_DESCRIPTOR,
        value: wValue,
        index: 0,
      },
      4,
    );

    if (firstResult.status !== "ok" || !firstResult.data) {
      throw new Error(
        `readConfigurationDescriptor head failed: ${firstResult.status}`,
      );
    }

    const wLength = firstResult.data.getUint16(2, true);
    const fullResult = await this.device_.controlTransferIn(
      {
        requestType: "standard",
        recipient: "device",
        request: GET_DESCRIPTOR,
        value: wValue,
        index: 0,
      },
      wLength,
    );

    if (fullResult.status !== "ok" || !fullResult.data) {
      throw new Error(
        `readConfigurationDescriptor full failed: ${fullResult.status}`,
      );
    }
    return fullResult.data;
  }

  async requestOut(
    bRequest: number,
    data?: BufferSource,
    wValue = 0,
  ): Promise<number> {
    let result: USBOutTransferResult;
    try {
      result = await this.device_.controlTransferOut(
        {
          requestType: "class",
          recipient: "interface",
          request: bRequest,
          value: wValue,
          index: this.intfNumber,
        },
        data,
      );
    } catch (error) {
      throw new Error(`ControlTransferOut failed: ${String(error)}`);
    }
    if (result.status !== "ok") {
      throw new Error(String(result.status));
    }
    return result.bytesWritten;
  }

  async requestIn(
    bRequest: number,
    wLength: number,
    wValue = 0,
  ): Promise<DataView> {
    let result: USBInTransferResult;
    try {
      result = await this.device_.controlTransferIn(
        {
          requestType: "class",
          recipient: "interface",
          request: bRequest,
          value: wValue,
          index: this.intfNumber,
        },
        wLength,
      );
    } catch (error) {
      throw new Error(`ControlTransferIn failed: ${String(error)}`);
    }
    if (result.status !== "ok" || !result.data) {
      throw new Error(String(result.status));
    }
    return result.data;
  }

  detach(): Promise<number> {
    return this.requestOut(DFU_REQUEST.DETACH, undefined, 1000);
  }

  waitDisconnected(timeout: number): Promise<this> {
    const device = this;
    const usbDevice = this.device_;
    return new Promise((resolve, reject) => {
      let timeoutID: ReturnType<typeof setTimeout> | undefined;

      function onDisconnect(event: USBConnectionEvent): void {
        if (event.device === usbDevice) {
          if (timeoutID !== undefined) clearTimeout(timeoutID);
          device.disconnected = true;
          navigator.usb.removeEventListener("disconnect", onDisconnect);
          event.stopPropagation();
          resolve(device);
        }
      }

      if (timeout > 0) {
        timeoutID = setTimeout(() => {
          navigator.usb.removeEventListener("disconnect", onDisconnect);
          if (!device.disconnected) {
            reject(new Error("Disconnect timeout expired"));
          }
        }, timeout);
      }

      navigator.usb.addEventListener("disconnect", onDisconnect);
    });
  }

  download(data: BufferSource, blockNum: number): Promise<number> {
    return this.requestOut(DFU_REQUEST.DNLOAD, data, blockNum);
  }

  upload(length: number, blockNum: number): Promise<DataView> {
    return this.requestIn(DFU_REQUEST.UPLOAD, length, blockNum);
  }

  clearStatus(): Promise<number> {
    return this.requestOut(DFU_REQUEST.CLRSTATUS);
  }

  async getStatus(): Promise<DfuStatus> {
    let data: DataView;
    try {
      data = await this.requestIn(DFU_REQUEST.GETSTATUS, 6);
    } catch (error) {
      throw new Error(`DFU GETSTATUS failed: ${String(error)}`);
    }
    return {
      status: data.getUint8(0),
      pollTimeout: data.getUint32(1, true) & 0xffffff,
      state: data.getUint8(4),
    };
  }

  async getState(): Promise<number> {
    let data: DataView;
    try {
      data = await this.requestIn(DFU_REQUEST.GETSTATE, 1);
    } catch (error) {
      throw new Error(`DFU GETSTATE failed: ${String(error)}`);
    }
    return data.getUint8(0);
  }

  abort(): Promise<number> {
    return this.requestOut(DFU_REQUEST.ABORT);
  }

  async abortToIdle(): Promise<void> {
    await this.abort();
    let state = await this.getState();
    if (state === DFU_STATE.dfuERROR) {
      await this.clearStatus();
      state = await this.getState();
    }
    if (state !== DFU_STATE.dfuIDLE) {
      throw new Error(`Failed to return to idle state after abort: state ${state}`);
    }
  }

  async do_upload(
    xfer_size: number,
    max_size: number = Infinity,
    first_block = 0,
  ): Promise<Blob> {
    let transaction = first_block;
    const blocks: ArrayBuffer[] = [];
    let bytes_read = 0;

    this.logInfo("Copying data from DFU device to browser");
    this.logProgress(0);

    let bytes_to_read: number;
    let result: DataView;
    do {
      bytes_to_read = Math.min(xfer_size, max_size - bytes_read);
      result = await this.upload(bytes_to_read, transaction++);
      this.logDebug(`Read ${result.byteLength} bytes`);
      if (result.byteLength > 0) {
        const copy = new ArrayBuffer(result.byteLength);
        new Uint8Array(copy).set(
          new Uint8Array(result.buffer, result.byteOffset, result.byteLength),
        );
        blocks.push(copy);
        bytes_read += result.byteLength;
      }
      if (Number.isFinite(max_size)) {
        this.logProgress(bytes_read, max_size);
      } else {
        this.logProgress(bytes_read);
      }
    } while (bytes_read < max_size && result.byteLength === bytes_to_read);

    if (bytes_read === max_size) {
      await this.abortToIdle();
    }

    this.logInfo(`Read ${bytes_read} bytes`);

    return new Blob(blocks, { type: "application/octet-stream" });
  }

  async poll_until(
    state_predicate: (state: number) => boolean,
  ): Promise<DfuStatus> {
    let dfu_status = await this.getStatus();

    const asyncSleep = (duration_ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, duration_ms));

    while (
      !state_predicate(dfu_status.state) &&
      dfu_status.state !== DFU_STATE.dfuERROR
    ) {
      await asyncSleep(dfu_status.pollTimeout);
      dfu_status = await this.getStatus();
    }

    return dfu_status;
  }

  poll_until_idle(idle_state: number): Promise<DfuStatus> {
    return this.poll_until((state) => state === idle_state);
  }

  async do_download(
    xfer_size: number,
    data: ArrayBuffer,
    manifestationTolerant: boolean,
  ): Promise<void> {
    let bytes_sent = 0;
    const expected_size = data.byteLength;
    let transaction = 0;

    this.logInfo("Copying data from browser to DFU device");
    this.logProgress(bytes_sent, expected_size);

    while (bytes_sent < expected_size) {
      const bytes_left = expected_size - bytes_sent;
      const chunk_size = Math.min(bytes_left, xfer_size);

      let bytes_written = 0;
      let dfu_status: DfuStatus;
      try {
        bytes_written = await this.download(
          data.slice(bytes_sent, bytes_sent + chunk_size),
          transaction++,
        );
        dfu_status = await this.poll_until_idle(DFU_STATE.dfuDNLOAD_IDLE);
      } catch (error) {
        throw new Error(`Error during DFU download: ${String(error)}`);
      }

      if (dfu_status.status !== DFU_STATUS_OK) {
        throw new Error(
          `DFU DOWNLOAD failed state=${dfu_status.state}, status=${dfu_status.status}`,
        );
      }

      bytes_sent += bytes_written;
      this.logProgress(bytes_sent, expected_size);
    }

    try {
      await this.download(new ArrayBuffer(0), transaction++);
    } catch (error) {
      throw new Error(`Error during final DFU download: ${String(error)}`);
    }

    this.logInfo("Manifesting new firmware");

    if (manifestationTolerant) {
      try {
        const dfu_status = await this.poll_until(
          (state) =>
            state === DFU_STATE.dfuIDLE ||
            state === DFU_STATE.dfuMANIFEST_WAIT_RESET,
        );
        if (dfu_status.state === DFU_STATE.dfuMANIFEST_WAIT_RESET) {
          this.logDebug(
            "Device transitioned to MANIFEST_WAIT_RESET even though it is manifestation tolerant",
          );
        }
        if (dfu_status.status !== DFU_STATUS_OK) {
          throw new Error(
            `DFU MANIFEST failed state=${dfu_status.state}, status=${dfu_status.status}`,
          );
        }
      } catch (error) {
        const msg = String(error);
        if (
          msg.endsWith(
            "ControlTransferIn failed: NotFoundError: Device unavailable.",
          ) ||
          msg.endsWith(
            "ControlTransferIn failed: NotFoundError: The device was disconnected.",
          )
        ) {
          this.logWarning("Unable to poll final manifestation status");
        } else {
          throw new Error(`Error during DFU manifest: ${msg}`);
        }
      }
    } else {
      try {
        const final_status = await this.getStatus();
        this.logDebug(
          `Final DFU status: state=${final_status.state}, status=${final_status.status}`,
        );
      } catch (error) {
        this.logDebug(`Manifest GET_STATUS poll error: ${String(error)}`);
      }
    }

    try {
      await this.device_.reset();
    } catch (error) {
      const msg = String(error);
      if (
        msg === "NetworkError: Unable to reset the device." ||
        msg === "NotFoundError: Device unavailable." ||
        msg === "NotFoundError: The device was disconnected."
      ) {
        this.logDebug("Ignored reset error");
      } else {
        throw new Error(`Error during reset for manifestation: ${msg}`);
      }
    }
  }
}
