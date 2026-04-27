// Minimum surface of USBDevice that DfuDevice / DfuseDevice actually consume.
// A real navigator.usb USBDevice satisfies this structurally; the in-repo
// FakeDfuseTransport implements it for hardware-free dev/testing.

export interface UsbTransport {
  configurations: ReadonlyArray<USBConfiguration>;
  configuration: USBConfiguration | null;

  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(
    interfaceNumber: number,
    alternateSetting: number,
  ): Promise<void>;
  controlTransferIn(
    setup: USBControlTransferParameters,
    length: number,
  ): Promise<USBInTransferResult>;
  controlTransferOut(
    setup: USBControlTransferParameters,
    data?: BufferSource,
  ): Promise<USBOutTransferResult>;
  reset(): Promise<void>;
}
