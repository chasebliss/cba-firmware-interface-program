import { useEffect, useRef, useState, type ReactNode } from "react";
import { BinaryHero } from "@/components/BinaryHero";
import { CbaButton } from "@/components/CbaButton";
import { InstructionsPanel } from "@/components/Instructions";
import { Nav, type NavProps } from "@/components/Nav";
import { PedalDropdown } from "@/components/PedalDropdown";
import { ReleaseNotes } from "@/components/ReleaseNotes";
import { StepCard } from "@/components/StepCard";
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

type FlashStatus = "idle" | "preparing" | "installing" | "complete" | "error";

type ConnectedDevice = Awaited<
  ReturnType<typeof requestAndConnectDevice>
>["device"];

interface ProgrammerProps {
  sources: FirmwareSource[];
  showInactive?: boolean;
  banner?: ReactNode;
  title?: string;
  navProps?: NavProps;
  heroWidth?: number;
  heroOpacity?: number;
  // Shown inside step 1, directly under the firmware picker. Sits at the
  // moment of choosing rather than at the top of the page, where a channel
  // warning is scrolled past before it matters.
  channelNotice?: ReactNode;
  // Explainer block above the step stack, below the title. For orienting a
  // reader who landed on a non-default channel ("what is this page?") before
  // they start picking firmware.
  intro?: ReactNode;
  // When set, step 3 requires ticking an acknowledgement before Update
  // enables. Lives in step 3 rather than step 1 so the consent sits at the
  // irreversible action, not two steps upstream where it gets scrolled past.
  // Resets on "Flash again" — one acknowledgement per flash.
  disclaimer?: ReactNode;
}

export const Programmer = ({
  sources,
  showInactive = false,
  banner,
  title = "Bliss Programmer.",
  navProps,
  heroWidth = 500,
  heroOpacity = 1,
  channelNotice,
  intro,
  disclaimer,
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
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Deferred so the loading reset doesn't run synchronously inside the
    // effect, which would cascade an extra render. The same `cancelled` flag
    // that guards the fetch result guards this, so a rerun with new sources
    // can't have a superseded load flip the flags back.
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setCatalogueLoading(true);
      setCatalogueError(null);
    });

    loadFirmwareCatalogue(sources)
      .then((entries) => {
        if (cancelled) return;
        setCatalogue(showInactive ? entries : entries.filter((e) => e.active));
        setCatalogueLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogueError(err instanceof Error ? err.message : String(err));
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
    if (disclaimer && !acknowledged) return;

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

  const handleReset = () => {
    setSelected(null);
    setConnectStatus("disconnected");
    setConnectError(null);
    setFlashStatus("idle");
    setFlashMessage(null);
    setFlashError(null);
    setFlashProgress({ done: 0, total: 0 });
    setAcknowledged(false);
  };

  const s3 = flashStatus === "complete";
  const s1 = selected !== null || s3;
  const s2 = connectStatus === "connected" || s3;

  const flashing = flashStatus === "preparing" || flashStatus === "installing";
  const errored = flashStatus === "error";

  const progressRatio =
    flashProgress.total > 0
      ? Math.min(1, flashProgress.done / flashProgress.total)
      : 0;
  const progressPct = Math.round(progressRatio * 100);
  const barColor = selected?.bgColor ?? "var(--ok)";

  const card1Background = s1 ? `${selected!.bgColor}10` : "var(--surface)";

  return (
    <div className="min-h-screen animate-cba-fade-in bg-surface">
      <SuccessBurst trigger={burstTrigger} />
      {banner}
      <Nav {...navProps} />
      <div
        className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-8 px-[7vw] md:grid-cols-[1fr_1px_300px] md:gap-0"
        style={{ minHeight: "calc(100vh - 80px)" }}
      >
        <div className="pb-8 pt-11 md:pb-20 md:pr-[52px]">
          <div className="mb-8 items-center flex flex-col gap-3">
            <h1
              className="font-bold tracking-[-0.02em]"
              style={{ fontSize: "clamp(1.6rem, 2.4vw, 2.25rem)" }}
            >
              {title}
            </h1>
            <BinaryHero
              width={heroWidth}
              opacity={heroOpacity}
              flashing={flashing}
            />
          </div>

          {intro}

          {/* Wrapper exists purely as a styling hook — /nightly rounds the
              stack's outer corners while leaving the cards' shared border
              seam intact. Layout-neutral everywhere else. Width comes from the
              column above. */}
          <div className="cba-step-stack">
          <StepCard
            n={1}
            label="Select firmware"
            done={s1}
            open={!s2}
            style={{ background: card1Background }}
            headerRight={
              s1 ? (
                <div className="flex items-center gap-2">
                  <div
                    className="h-[9px] w-[9px] shrink-0"
                    style={{ background: selected?.bgColor }}
                  />
                  <span className="text-caption font-semibold text-text/45">
                    {selected?.name}
                  </span>
                </div>
              ) : undefined
            }
          >
            <PedalDropdown
              firmwares={catalogue}
              selected={selected}
              onSelect={setSelected}
              loading={catalogueLoading}
              disabled={flashing}
            />
            {catalogueError && (
              <p className="mt-2 text-sm font-semibold text-bad">
                Could not load firmware list: {catalogueError}
              </p>
            )}
            {channelNotice}
          </StepCard>

          <StepCard
            n={2}
            label="Connect pedal"
            done={s2}
            locked={!s1}
            open={!s2 && !s3}
            headerRight={
              s2 ? (
                <span className="text-caption font-bold text-ok">
                  Connected ✓
                </span>
              ) : undefined
            }
          >
            <div className="flex flex-col items-center gap-2.5">
              <p className="text-sm leading-[1.6] text-text/[0.42]">
                Connect via data-transfer micro USB, then connect power supply.
              </p>
              <CbaButton
                disabled={!s1 || connectStatus === "connecting"}
                onClick={handleConnect}
                style={{ width: 180 }}
              >
                {connectStatus === "connecting" ? "Connecting…" : "Connect"}
              </CbaButton>
              {connectError && (
                <p className="max-w-md text-sm font-semibold text-bad">
                  {connectError}
                </p>
              )}
            </div>
          </StepCard>

          <StepCard
            n={3}
            label="Update firmware"
            done={s3}
            locked={!s2 && !s3}
            headerRight={
              s3 ? (
                <span className="text-caption font-bold text-ok">
                  Complete ✓
                </span>
              ) : undefined
            }
          >
            <div
              key={
                flashing
                  ? "flashing"
                  : errored
                    ? "error"
                    : s3
                      ? "complete"
                      : "idle"
              }
              className="animate-tab-fade"
            >
              {!flashing && !s3 && !errored && (
                <div className="flex flex-col items-center gap-3.5">
                  {disclaimer && (
                    // w-96 + mx-auto matches PedalDropdown and the channel
                    // notice, so the consent block lines up with the rest of
                    // the stack instead of spanning the whole card.
                    <label className="cba-panel mx-auto flex w-96 max-w-full cursor-pointer select-none items-start gap-2.5 border-2 border-border/15 bg-text/[0.03] px-3.5 py-3 text-left transition-colors duration-200 hover:border-border/30">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        disabled={!s1 || !s2}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-[2px] h-[15px] w-[15px] shrink-0 accent-text disabled:cursor-not-allowed"
                      />
                      <span className="text-caption leading-[1.5] text-text/60">
                        {disclaimer}
                      </span>
                    </label>
                  )}
                  <CbaButton
                    disabled={!s1 || !s2 || (!!disclaimer && !acknowledged)}
                    variant={
                      s1 && s2 && (!disclaimer || acknowledged)
                        ? "success"
                        : "default"
                    }
                    onClick={handleUpdate}
                    style={{ width: 180 }}
                  >
                    Update
                  </CbaButton>
                </div>
              )}
              {flashing && (
                <div className="flex flex-col items-center gap-2.5">
                  <progress
                    value={progressPct}
                    max={100}
                    className="block h-[5px] w-96 max-w-full appearance-none border-none [&::-webkit-progress-bar]:bg-text/10"
                  />
                  <style>{`progress::-webkit-progress-value{background:${barColor};transition:width .4s ease;}progress::-moz-progress-bar{background:${barColor};}`}</style>
                  <div className="animate-cba-pulse text-body font-bold text-ok">
                    {flashStatus === "preparing"
                      ? (flashMessage ?? "Preparing…")
                      : `Uploading… ${progressPct}%`}
                  </div>
                </div>
              )}
              {errored && (
                <div className="flex flex-col items-center gap-2.5">
                  <progress
                    value={progressPct}
                    max={100}
                    className="block h-[5px] w-96 max-w-full appearance-none border-none [&::-webkit-progress-bar]:bg-text/10"
                  />
                  <style>{`progress::-webkit-progress-value{background:var(--bad);transition:width .4s ease;}progress::-moz-progress-bar{background:var(--bad);}`}</style>
                  <p className="text-body font-bold text-bad">
                    {flashError ?? "Update failed"}
                  </p>
                  <CbaButton onClick={handleReset} style={{ width: 180 }}>
                    Try again
                  </CbaButton>
                </div>
              )}
              {s3 && (
                <CbaButton onClick={handleReset} style={{ width: 180 }}>
                  Flash again
                </CbaButton>
              )}
            </div>
          </StepCard>
          </div>
        </div>

        <div className="self-stretch bg-text/9" />

        <div
          className="pb-20 pl-9 pt-11"
          style={{ position: "sticky", top: 24 }}
        >
          <InstructionsPanel />
          {selected && (
            <ReleaseNotes firmware={selected} catalogue={catalogue} />
          )}
        </div>
      </div>
    </div>
  );
};
