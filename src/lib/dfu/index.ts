export {
  DFU_REQUEST,
  DFU_STATE,
  DFU_STATUS_OK,
  DfuDevice,
  findAllDfuInterfaces,
  findDeviceDfuInterfaces,
  parseConfigurationDescriptor,
  parseDeviceDescriptor,
  parseFunctionalDescriptor,
  parseInterfaceDescriptor,
  parseSubDescriptors,
  type ConfigurationDescriptor,
  type DfuDeviceProperties,
  type DfuFunctionalDescriptor,
  type DfuInterfaceSettings,
  type DfuLogger,
  type DfuState,
  type DfuStatus,
  type GenericDescriptor,
  type InterfaceDescriptor,
  type SubDescriptor,
} from "./dfu";

export {
  DFUSE_COMMAND,
  DfuseDevice,
  parseMemoryDescriptor,
  type FirmwareSegment,
  type MemoryInfo,
  type MemorySegment,
} from "./dfuse";

export { isHexPath, parseIntelHex } from "./intel-hex";

export {
  STM_VENDOR_ID,
  connectToSelected,
  fixInterfaceNames,
  getDFUDescriptorProperties,
  openDevice,
  requestAndConnectDevice,
  type ConnectResult,
} from "./connect";

export { FakeDfuseTransport, connectToFakeDevice } from "./fake-device";

export type { UsbTransport } from "./transport";
