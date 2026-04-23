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

  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [saveBgColor, setSaveBgColor] = useState("#ba8e51");
  const [saveTarget, setSaveTarget] = useState<"production" | "beta">("beta");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  const handleSave = async () => {
    if (!file) return;
    setSaveStatus("saving");
    setSaveMessage(null);
    try {
      const buf = await file.arrayBuffer();
      const contentBase64 = arrayBufferToBase64(buf);
      const resp = await fetch("/api/admin/upload-firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentBase64,
          target: saveTarget,
          name: saveName.trim(),
          description: saveDescription.trim(),
          bgColor: saveBgColor,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        commitUrl?: string;
      };
      if (!resp.ok) {
        setSaveStatus("error");
        setSaveMessage(data.error ?? `Upload failed (${resp.status})`);
        return;
      }
      setSaveStatus("success");
      setSaveMessage(
        `Committed to ${saveTarget}. Visible after next Vercel deploy.`,
      );
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const flashing =
    flashStatus === "preparing" || flashStatus === "installing";
  const flashActive = flashStatus !== "idle";

  const canSave =
    file !== null &&
    saveName.trim().length > 0 &&
    saveStatus !== "saving" &&
    !flashing;

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

  return (
    <div className="flex min-h-screen flex-col">
      <SuccessBurst trigger={burstTrigger} />
      <div className="flex flex-1 flex-col animate-cba-fade-in px-[7vw] pb-20">
        <Nav />
        <main className="flex flex-col items-center pt-8">
          <HeadingBox>Admin Flasher.</HeadingBox>
          <BinaryHero flashing={flashing} />
          <FlashProgressBar
            done={flashProgress.done}
            total={flashProgress.total}
            bgColor="#ba8e51"
            errored={flashStatus === "error"}
            visible={flashActive && flashStatus !== "preparing"}
          />
          <div className="mt-2 flex flex-col items-center gap-4">
            <label className="flex h-[50px] w-[240px] cursor-pointer items-center justify-center border-2 border-black bg-cream px-3 py-2 text-center text-base font-bold transition-shadow duration-300 ease-in-out hover:italic hover:shadow-cba">
              <span className="truncate">
                {file ? file.name : "Choose .bin or .hex file"}
              </span>
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

          {file && (
            <div className="mt-10 w-[320px] max-w-full border-t-2 border-black pt-6">
              <p className="pb-3 text-center text-sm font-bold uppercase tracking-widest">
                Save to repo (optional)
              </p>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs font-bold">
                  Name
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="e.g. MOOD MKII v1.2"
                    className="border-2 border-black bg-cream px-3 py-2 text-base font-bold"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold">
                  Description
                  <input
                    type="text"
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    placeholder="Optional"
                    className="border-2 border-black bg-cream px-3 py-2 text-base font-bold"
                  />
                </label>
                <label className="flex items-center gap-3 text-xs font-bold">
                  Background color
                  <input
                    type="color"
                    value={saveBgColor}
                    onChange={(e) => setSaveBgColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer border-2 border-black"
                  />
                </label>
                <fieldset className="flex gap-4 text-xs font-bold">
                  <legend className="sr-only">Target</legend>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="saveTarget"
                      value="beta"
                      checked={saveTarget === "beta"}
                      onChange={() => setSaveTarget("beta")}
                    />
                    Beta
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="saveTarget"
                      value="production"
                      checked={saveTarget === "production"}
                      onChange={() => setSaveTarget("production")}
                    />
                    Production
                  </label>
                </fieldset>
                <CbaButton disabled={!canSave} onClick={handleSave}>
                  {saveStatus === "saving" ? "Saving…" : "Save to repo"}
                </CbaButton>
                {saveMessage && (
                  <p
                    className={`text-center text-sm font-semibold ${saveStatus === "error" ? "text-red" : "text-green"}`}
                  >
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
};
