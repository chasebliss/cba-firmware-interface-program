import {
  DfuDevice,
  findDeviceDfuInterfaces,
  parseConfigurationDescriptor,
  type DfuDeviceProperties,
  type DfuFunctionalDescriptor,
  type DfuInterfaceSettings,
  type SubDescriptor,
} from "./dfu";
import { DfuseDevice } from "./dfuse";

// STMicroelectronics, hardcoded in the old connect handler.
export const STM_VENDOR_ID = 0x0483;

// DfuSe 1.1a (0x011a) is the ST Microelectronics variant that exposes a
// memory map via the interface name string.
const DFUSE_VERSION = 0x011a;

// On multi-interface devices, pick the interface whose name advertises the
// STM32 main flash region (0x08000000). The old app filtered for this.
const MAIN_FLASH_MARKER = "0x08000000";

export const fixInterfaceNames = async (
  rawDevice: USBDevice,
  interfaces: DfuInterfaceSettings[],
): Promise<void> => {
  if (!interfaces.some((intf) => intf.name === null)) return;

  const tempDevice = new DfuDevice(rawDevice, interfaces[0]!);
  await tempDevice.device_.open();
  await tempDevice.device_.selectConfiguration(1);
  const mapping = await tempDevice.readInterfaceNames();
  await tempDevice.close();

  for (const intf of interfaces) {
    if (intf.name === null) {
      const configIndex = intf.configuration.configurationValue;
      const intfNumber = intf.interface.interfaceNumber;
      const alt = intf.alternate.alternateSetting;
      intf.name = mapping[configIndex]?.[intfNumber]?.[alt] ?? null;
    }
  }
}

export const getDFUDescriptorProperties = async (
  device: DfuDevice,
): Promise<Partial<DfuDeviceProperties>> => {
  try {
    const data = await device.readConfigurationDescriptor(0);
    const configDesc = parseConfigurationDescriptor(data);
    const configValue = device.settings.configuration.configurationValue;
    if (configDesc.bConfigurationValue !== configValue) return {};

    const funcDesc = findFunctionalDescriptor(configDesc.descriptors);
    if (!funcDesc) return {};

    return {
      WillDetach: (funcDesc.bmAttributes & 0x08) !== 0,
      ManifestationTolerant: (funcDesc.bmAttributes & 0x04) !== 0,
      CanUpload: (funcDesc.bmAttributes & 0x02) !== 0,
      CanDnload: (funcDesc.bmAttributes & 0x01) !== 0,
      TransferSize: funcDesc.wTransferSize,
      DetachTimeOut: funcDesc.wDetachTimeOut,
      DFUVersion: funcDesc.bcdDFUVersion,
    };
  } catch {
    return {};
  }
}

const findFunctionalDescriptor = (
  descriptors: SubDescriptor[],
): DfuFunctionalDescriptor | null => {
  for (const desc of descriptors) {
    if (desc.bDescriptorType === 0x21 && "bcdDFUVersion" in desc) {
      return desc;
    }
  }
  return null;
};

export interface ConnectResult {
  device: DfuDevice | DfuseDevice;
  properties: Partial<DfuDeviceProperties>;
}

// Open the device, read its DFU functional descriptor, and upgrade to a
// DfuseDevice if the interface advertises DfuSe 1.1a with a parseable memory
// map. Mirrors the old app's connect() flow without the DOM side effects.
export const openDevice = async (
  device: DfuDevice,
): Promise<ConnectResult> => {
  await device.open();
  const properties = await getDFUDescriptorProperties(device);

  let resolved: DfuDevice | DfuseDevice = device;
  if (
    properties.DFUVersion === DFUSE_VERSION &&
    device.settings.alternate.interfaceProtocol === 0x02
  ) {
    resolved = new DfuseDevice(device.device_, device.settings);
    resolved.logger = device.logger;
  }

  if (resolved instanceof DfuseDevice && resolved.memoryInfo) {
    const segment = resolved.getFirstWritableSegment();
    if (segment) {
      // STM32H7 bank-2 begins at 0x90000000. The first writable sector is
      // actually 0x40000 bytes in — without this nudge, the first erase
      // targets a non-existent sector and fails.
      if (segment.start === 0x90000000) segment.start += 0x40000;
      resolved.startAddress = segment.start;
    }
  }

  if (properties.TransferSize !== undefined) {
    resolved.properties = properties as DfuDeviceProperties;
  }

  return { device: resolved, properties };
};

export const requestAndConnectDevice = async (options?: {
  serial?: string;
}): Promise<ConnectResult> => {
  const filters: USBDeviceFilter[] = [];
  if (options?.serial) {
    filters.push({ serialNumber: options.serial });
  }
  filters.push({ vendorId: STM_VENDOR_ID });

  const selectedDevice = await navigator.usb.requestDevice({ filters });
  return connectToSelected(selectedDevice);
};

export const connectToSelected = async (
  selectedDevice: USBDevice,
): Promise<ConnectResult> => {
  const interfaces = findDeviceDfuInterfaces(selectedDevice);
  if (interfaces.length === 0) {
    throw new Error("The selected device does not have any USB DFU interfaces.");
  }

  await fixInterfaceNames(selectedDevice, interfaces);

  let chosen: DfuInterfaceSettings;
  if (interfaces.length === 1) {
    chosen = interfaces[0]!;
  } else {
    const filtered = interfaces.filter(
      (ifc) => ifc.name?.includes(MAIN_FLASH_MARKER) ?? false,
    );
    if (filtered.length === 0) {
      throw new Error(
        `The selected device does not have a Flash Memory section at address ${MAIN_FLASH_MARKER}.`,
      );
    }
    chosen = filtered[0]!;
  }

  return openDevice(new DfuDevice(selectedDevice, chosen));
};
