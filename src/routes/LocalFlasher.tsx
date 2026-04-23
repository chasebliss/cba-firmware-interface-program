import { useEffect, useRef, useState } from "react";
import { BinaryHero } from "@/components/BinaryHero";
import { CbaButton } from "@/components/CbaButton";
import { HeadingBox } from "@/components/HeadingBox";
import { Nav } from "@/components/Nav";
import {
  FlashProgressBar,
  FlashStatusPill,
} from "@/components/ProgressOverlay";
import { SuccessBurst } from "@/components/SuccessBurst";
import {
  DfuseDevice,
  isHexPath,
  parseIntelHex,
  requestAndConnectDevice,
  type DfuLogger,
  type FirmwareSegment,
} from "@/lib/dfu";

const DEFAULT_TRANSFER_SIZE = 1024;

type FlashStatus =
  | "idle"
  | "preparing"
  | "installing"
  | "complete"
  | "error";

type ConnectedDevice = Awaited<
  ReturnType<typeof requestAndConnectDevice>
>["device"];

type LocalPayload =
  | { kind: "bin"; buffer: ArrayBuffer }
  | { kind: "hex"; segments: FirmwareSegment[] };

export const LocalFlasher = () => {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<LocalPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const deviceRef = useRef<ConnectedDevice | null>(null);
  const transferSizeRef = useRef<number>(DEFAULT_TRANSFER_SIZE);
  const manifestationTolerantRef = useRef<boolean>(true);

  const [connectStatus, setConnectStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [connectError, setConnectError] = useState<string | null>(null);

  const [flashStatus, setFlashStatus] = useState<FlashStatus>("idle");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState({ done: 0, total: 0 });
  const [flashError, setFlashError] = useState<string | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);

  useEffect(() => {
    return () => {
      void deviceRef.current?.close();
      deviceRef.current = null;
    };
  }, []);

  const handleFile = async (picked: File | null) => {
    setParseError(null);
    setPayload(null);
    setFile(picked);
    if (!picked) return;
    try {
      if (isHexPath(picked.name)) {
        const text = await picked.text();
        setPayload({ kind: "hex", segments: parseIntelHex(text) });
      } else {
        setPayload({ kind: "bin", buffer: await picked.arrayBuffer() });
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConnect = async () => {
    setConnectError(null);
    setConnectStatus("connecting");
    try {
      const result = await requestAndConnectDevice();
      deviceRef.current = result.device;
      transferSizeRef.current =
        result.properties.TransferSize ?? DEFAULT_TRANSFER_SIZE;
      manifestationTolerantRef.current =
        result.properties.ManifestationTolerant ?? true;
      setConnectStatus("connected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isCancelled = /No device selected|user cancelled/i.test(msg);
      setConnectError(isCancelled ? null : msg);
      setConnectStatus("disconnected");
    }
  };

  const handleUpdate = async () => {
    const device = deviceRef.current;
    if (!device || !payload) return;

    setFlashStatus("preparing");
    setFlashMessage(null);
    setFlashError(null);
    setFlashProgress({ done: 0, total: 0 });

    const logger: DfuLogger = {
      info: (msg) => {
        setFlashMessage(msg);
        if (msg === "Installing...") {
          setFlashStatus("installing");
          setFlashProgress({ done: 0, total: 0 });
        } else if (msg === "Preparing...") {
          setFlashStatus("preparing");
        }
      },
      warning: (msg) => console.warn(msg),
      error: (msg) => {
        setFlashError(msg);
        setFlashStatus("error");
      },
      progress: (done, total) => {
        setFlashProgress({ done, total: total ?? 0 });
      },
    };
    device.logger = logger;

    try {
      try {
        const status = await device.getStatus();
        if (status.state === 10 /* dfuERROR */) {
          await device.clearStatus();
        }
      } catch {
        // best effort
      }

      const xferSize = transferSizeRef.current;
      const tolerant = manifestationTolerantRef.current;

      if (payload.kind === "hex") {
        if (!(device instanceof DfuseDevice)) {
          throw new Error(
            "Hex firmware requires a DfuSe device, but the connected device only speaks plain DFU.",
          );
        }
        await device.do_download_multi(xferSize, payload.segments, tolerant);
      } else {
        await device.do_download(xferSize, payload.buffer, tolerant);
      }

      setFlashStatus("complete");
      setFlashMessage("Successful");
      setBurstTrigger((n) => n + 1);

      if (!tolerant) {
        try {
          await device.waitDisconnected(5000);
        } catch {
          // device may have already gone
        }
      }
      await device.close();
      deviceRef.current = null;
      setConnectStatus("disconnected");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFlashError(msg);
      setFlashStatus("error");
    }
  };

  const canConnect =
    payload !== null &&
    connectStatus !== "connecting" &&
    flashStatus !== "preparing" &&
    flashStatus !== "installing";
  const canUpdate =
    connectStatus === "connected" &&
    payload !== null &&
    flashStatus !== "preparing" &&
    flashStatus !== "installing";

  const flashing =
    flashStatus === "preparing" || flashStatus === "installing";
  const flashActive = flashStatus !== "idle";

  return (
    <div className="flex min-h-screen flex-col">
      <SuccessBurst trigger={burstTrigger} />
      <div className="flex flex-1 flex-col animate-cba-fade-in px-[7vw] pb-20">
        <Nav />
        <main className="flex flex-col items-center pt-8">
          <HeadingBox>Admin Flasher.</HeadingBox>
          <BinaryHero />
          {flashActive && flashStatus !== "preparing" && (
            <FlashProgressBar
              done={flashProgress.done}
              total={flashProgress.total}
              bgColor="#ba8e51"
              errored={flashStatus === "error"}
            />
          )}
          <div className="mt-2 flex flex-col items-center gap-4">
            <label className="flex cursor-pointer items-center gap-3 border-2 border-black bg-cream px-4 py-3 text-sm font-bold transition hover:shadow-cba">
              <span>{file ? file.name : "Choose .bin or .hex file"}</span>
              <input
                type="file"
                accept=".bin,.hex"
                className="hidden"
                disabled={flashing}
                onChange={(e) => {
                  const picked = e.target.files?.[0] ?? null;
                  void handleFile(picked);
                }}
              />
            </label>
            {parseError && (
              <p className="max-w-md text-center text-sm font-semibold text-red">
                Could not parse file: {parseError}
              </p>
            )}
            {flashActive ? (
              <FlashStatusPill
                status={flashStatus}
                message={
                  flashStatus === "complete"
                    ? "Successful"
                    : flashStatus === "error"
                      ? flashError ?? "Update failed"
                      : flashMessage ?? undefined
                }
              />
            ) : (
              <>
                <CbaButton disabled={!canConnect} onClick={handleConnect}>
                  {connectStatus === "connecting"
                    ? "Connecting…"
                    : connectStatus === "connected"
                      ? "Connected"
                      : "Connect"}
                </CbaButton>
                <CbaButton
                  disabled={!canUpdate}
                  variant={
                    connectStatus === "connected" ? "success" : "default"
                  }
                  onClick={handleUpdate}
                >
                  Update
                </CbaButton>
                {connectStatus === "connected" && (
                  <p className="text-xs font-bold text-green">
                    Device connected — ready to update.
                  </p>
                )}
                {connectError && (
                  <p className="max-w-md text-center text-sm font-semibold text-red">
                    {connectError}
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
