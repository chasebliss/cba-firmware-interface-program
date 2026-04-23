import { useEffect, useRef, useState, type ReactNode } from "react";
import { BinaryHero } from "@/components/BinaryHero";
import { CbaButton } from "@/components/CbaButton";
import { HeadingBox } from "@/components/HeadingBox";
import { Nav } from "@/components/Nav";
import { PedalDropdown } from "@/components/PedalDropdown";
import {
  FlashProgressBar,
  FlashStatusPill,
} from "@/components/ProgressOverlay";
import { SuccessBurst } from "@/components/SuccessBurst";
import type { FirmwareSource } from "@/data/sources";
import {
  DfuseDevice,
  requestAndConnectDevice,
  type DfuLogger,
} from "@/lib/dfu";
import {
  fetchFirmwarePayload,
  loadFirmwareCatalogue,
  type FirmwareEntry,
} from "@/lib/firmware-catalogue";

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

interface ProgrammerProps {
  sources: FirmwareSource[];
  showInactive?: boolean;
  banner?: ReactNode;
  title?: string;
}

export const Programmer = ({
  sources,
  showInactive = false,
  banner,
  title = "Bliss Programmer.",
}: ProgrammerProps) => {
  const [catalogue, setCatalogue] = useState<FirmwareEntry[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [selected, setSelected] = useState<FirmwareEntry | null>(null);
  const deviceRef = useRef<ConnectedDevice | null>(null);
  const transferSizeRef = useRef<number>(DEFAULT_TRANSFER_SIZE);
  const manifestationTolerantRef = useRef<boolean>(true);

  const [connectStatus, setConnectStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [connectError, setConnectError] = useState<string | null>(null);

  // Dev-only: ?demo=installing|preparing|complete|error previews the flash UI
  // without needing real hardware. Stripped in prod by Vite.
  const demoFlash = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get("demo")
    : null;
  const initialFlashStatus: FlashStatus =
    demoFlash === "installing"
      ? "installing"
      : demoFlash === "preparing"
        ? "preparing"
        : demoFlash === "complete"
          ? "complete"
          : demoFlash === "error"
            ? "error"
            : "idle";

  const [flashStatus, setFlashStatus] =
    useState<FlashStatus>(initialFlashStatus);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState(
    demoFlash === "installing" || demoFlash === "preparing"
      ? { done: 67, total: 100 }
      : demoFlash === "complete"
        ? { done: 100, total: 100 }
        : { done: 0, total: 0 },
  );
  const [flashError, setFlashError] = useState<string | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueError(null);

    loadFirmwareCatalogue(sources)
      .then((entries) => {
        if (cancelled) return;
        setCatalogue(showInactive ? entries : entries.filter((e) => e.active));
        setCatalogueLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogueError(
          err instanceof Error ? err.message : String(err),
        );
        setCatalogueLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sources, showInactive]);

  useEffect(() => {
    return () => {
      void deviceRef.current?.close();
      deviceRef.current = null;
    };
  }, []);

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
    const firmware = selected;
    if (!device || !firmware) return;

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

      const payload = await fetchFirmwarePayload(firmware);
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
    selected !== null &&
    connectStatus !== "connecting" &&
    flashStatus !== "preparing" &&
    flashStatus !== "installing";
  const canUpdate =
    connectStatus === "connected" &&
    selected !== null &&
    flashStatus !== "preparing" &&
    flashStatus !== "installing";

  const flashing =
    flashStatus === "preparing" || flashStatus === "installing";
  const flashActive = flashStatus !== "idle";

  return (
    <div className="flex min-h-screen flex-col">
      <SuccessBurst trigger={burstTrigger} />
      {banner}
      <div className="flex flex-1 flex-col animate-cba-fade-in px-[7vw] pb-20">
        <Nav />
        <main className="flex flex-col items-center pt-8">
          <HeadingBox>{title}</HeadingBox>
          <BinaryHero flashing={flashing} />
          <FlashProgressBar
            done={flashProgress.done}
            total={flashProgress.total}
            bgColor={selected?.bgColor ?? "#a17399"}
            errored={flashStatus === "error"}
            visible={flashActive && flashStatus !== "preparing"}
          />
          <div className="mt-2 flex flex-col items-center gap-4">
            <PedalDropdown
              firmwares={catalogue}
              selected={selected}
              onSelect={setSelected}
              loading={catalogueLoading}
              disabled={flashing}
            />
            {catalogueError && (
              <p className="max-w-md text-center text-sm font-semibold text-red">
                Could not load firmware list: {catalogueError}
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
