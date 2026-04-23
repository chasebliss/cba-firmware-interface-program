import { useEffect, useRef, useState } from "react";
import { AdminHeader } from "@/components/AdminHeader";
import { CbaButton } from "@/components/CbaButton";
import { SectionLabel } from "@/components/SectionLabel";
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
const GOLD = "#ba8e51";

type FlashStatus = "idle" | "preparing" | "installing" | "complete" | "error";

type ConnectedDevice = Awaited<
  ReturnType<typeof requestAndConnectDevice>
>["device"];

type LocalPayload =
  | { kind: "bin"; buffer: ArrayBuffer }
  | { kind: "hex"; segments: FirmwareSegment[] };

interface ManifestEntry {
  name: string;
  filepath: string;
  bgColor?: string;
  description?: string;
}

interface AdminFirmware {
  name: string;
  filename: string;
  target: "production" | "beta";
  bgColor: string;
  description: string;
}

export const LocalFlasher = () => {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<LocalPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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
  const [saveBgColor, setSaveBgColor] = useState(GOLD);
  const [saveTarget, setSaveTarget] = useState<"production" | "beta">("beta");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  // When non-null, the form is in "edit mode" — Load was clicked on this
  // catalogue row. Save becomes Update/Copy; banner + confirmations kick in.
  const [editingEntry, setEditingEntry] = useState<AdminFirmware | null>(null);
  // Snapshot of form values at load time — used to detect unsaved edits.
  const [initialSnapshot, setInitialSnapshot] = useState<{
    name: string;
    description: string;
    bgColor: string;
    target: "production" | "beta";
    filename: string | null;
  } | null>(null);

  const [catalogue, setCatalogue] = useState<AdminFirmware[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [targetFilter, setTargetFilter] = useState<
    "all" | "production" | "beta"
  >("all");
  // Per-row deploy state: "live" once the file is served by the CDN, "pending"
  // if we got a 404 (uploaded but Vercel hasn't redeployed yet), "checking"
  // while the HEAD probe is in flight.
  const [deployStatus, setDeployStatus] = useState<
    Record<string, "checking" | "live" | "pending">
  >({});

  const loadCatalogues = async () => {
    setCatalogueLoading(true);
    setCatalogueError(null);
    try {
      const resp = await fetch("/api/admin/list-firmwares");
      const data = (await resp.json().catch(() => ({}))) as {
        production?: ManifestEntry[];
        beta?: ManifestEntry[];
        error?: string;
      };
      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      const toAdmin = (
        entries: ManifestEntry[] | undefined,
        target: "production" | "beta",
      ): AdminFirmware[] =>
        (entries ?? []).map((e) => ({
          name: e.name,
          filename: e.filepath.replace(/^\.\//, ""),
          target,
          bgColor: e.bgColor ?? GOLD,
          description: e.description ?? "",
        }));
      const merged = [
        ...toAdmin(data.production, "production"),
        ...toAdmin(data.beta, "beta"),
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
      setCatalogue(merged);
      void probeDeployStatus(merged);
    } catch (err) {
      setCatalogueError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogueLoading(false);
    }
  };

  const probeDeployStatus = async (entries: AdminFirmware[]) => {
    setDeployStatus((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        next[`${e.target}:${e.filename}`] = "checking";
      }
      return next;
    });
    await Promise.all(
      entries.map(async (entry) => {
        const base = entry.target === "beta" ? "/beta/firmware/" : "/firmware/";
        const url = `${base}${entry.filename}`;
        try {
          const resp = await fetch(url, { method: "HEAD", cache: "no-store" });
          setDeployStatus((prev) => ({
            ...prev,
            [`${entry.target}:${entry.filename}`]: resp.ok ? "live" : "pending",
          }));
        } catch {
          setDeployStatus((prev) => ({
            ...prev,
            [`${entry.target}:${entry.filename}`]: "pending",
          }));
        }
      }),
    );
  };

  useEffect(() => {
    void loadCatalogues();
  }, []);

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

  const handleLoadFromRepo = async (entry: AdminFirmware) => {
    if (isDirty()) {
      const ok = window.confirm(
        "You have unsaved changes in the save form. Load this firmware and discard them?",
      );
      if (!ok) return;
    }
    const base = entry.target === "beta" ? "/beta/firmware/" : "/firmware/";
    const url = `${base}${entry.filename}`;
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const picked = new File([blob], entry.filename, { type: blob.type });
      await handleFile(picked);
      setSaveName(entry.name);
      setSaveDescription(entry.description);
      setSaveBgColor(entry.bgColor);
      setSaveTarget(entry.target);
      setSaveStatus("idle");
      setSaveMessage(null);
      setEditingEntry(entry);
      setInitialSnapshot({
        name: entry.name,
        description: entry.description,
        bgColor: entry.bgColor,
        target: entry.target,
        filename: entry.filename,
      });
    } catch (err) {
      setParseError(
        `Could not load ${entry.filename}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const resetSaveForm = () => {
    setSaveName("");
    setSaveDescription("");
    setSaveBgColor(GOLD);
    setSaveTarget("beta");
    setSaveStatus("idle");
    setSaveMessage(null);
    setEditingEntry(null);
    setInitialSnapshot(null);
  };

  // True if anything the user might want to save has diverged from the
  // snapshot — or, in new-upload mode, if any form field is non-default.
  const isDirty = () => {
    if (initialSnapshot) {
      return (
        saveName !== initialSnapshot.name ||
        saveDescription !== initialSnapshot.description ||
        saveBgColor !== initialSnapshot.bgColor ||
        saveTarget !== initialSnapshot.target
      );
    }
    return (
      saveName.trim().length > 0 ||
      saveDescription.trim().length > 0 ||
      saveBgColor !== GOLD ||
      saveTarget !== "beta"
    );
  };

  const handleRemoveFile = () => {
    if (isDirty()) {
      const ok = window.confirm(
        "You have unsaved changes. Remove the loaded file and discard them?",
      );
      if (!ok) return;
    }
    setFile(null);
    setPayload(null);
    setParseError(null);
    setFlashStatus("idle");
    setFlashMessage(null);
    setFlashError(null);
    setFlashProgress({ done: 0, total: 0 });
    resetSaveForm();
  };

  // Used by the save-form Cancel button when in edit mode, and by "Save to
  // repo" success to return to a fresh state.
  const handleCancelEdit = () => {
    if (isDirty()) {
      const ok = window.confirm(
        "Discard unsaved changes to this firmware's metadata?",
      );
      if (!ok) return;
    }
    resetSaveForm();
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

  const handleFlashAgain = () => {
    setFlashStatus("idle");
    setFlashMessage(null);
    setFlashError(null);
    setFlashProgress({ done: 0, total: 0 });
  };

  const handleSave = async () => {
    if (!file) return;
    // Destructive overwrite confirmation: the row is edited-in-place AND it's
    // already live on the CDN, so users could briefly see the new file as soon
    // as the next Vercel deploy lands.
    if (editingEntry && editingEntry.target === saveTarget) {
      const key = `${editingEntry.target}:${editingEntry.filename}`;
      if (deployStatus[key] === "live") {
        const ok = window.confirm(
          `Overwrite "${editingEntry.name}" in ${editingEntry.target}? Users will see the updated firmware once Vercel redeploys.`,
        );
        if (!ok) return;
      }
    }
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
      setSaveMessage(null);
      setFile(null);
      setPayload(null);
      setParseError(null);
      setFlashStatus("idle");
      setFlashMessage(null);
      setFlashError(null);
      setFlashProgress({ done: 0, total: 0 });
      resetSaveForm();
      void loadCatalogues();
    } catch (err) {
      setSaveStatus("error");
      setSaveMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (entry: AdminFirmware) => {
    if (
      !window.confirm(
        `Delete ${entry.name} (${entry.filename}) from ${entry.target}? This can't be undone.`,
      )
    ) {
      return;
    }
    setDeleting(`${entry.target}:${entry.filename}`);
    try {
      const resp = await fetch("/api/admin/delete-firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: entry.filename,
          target: entry.target,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!resp.ok) {
        window.alert(`Delete failed: ${data.error ?? resp.status}`);
        return;
      }
      await loadCatalogues();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const flashing = flashStatus === "preparing" || flashStatus === "installing";
  const flashActive = flashStatus !== "idle";
  const errored = flashStatus === "error";
  const flashDone = flashStatus === "complete";

  const isEditing = editingEntry !== null;
  const targetChanged =
    isEditing && editingEntry !== null && editingEntry.target !== saveTarget;
  // Conflict in the destination target. If we're editing in place (target
  // unchanged) the match is self — not a conflict. If we've flipped the target
  // radio (copy) the match is a real conflict that should block the save.
  const duplicateInTarget =
    file !== null &&
    catalogue.some(
      (e) =>
        e.target === saveTarget &&
        e.filename === file.name &&
        !(
          editingEntry &&
          editingEntry.target === e.target &&
          editingEntry.filename === e.filename
        ),
    );
  const canSave =
    file !== null &&
    saveName.trim().length > 0 &&
    saveStatus !== "saving" &&
    !flashing &&
    !duplicateInTarget;
  const saveButtonLabel = isEditing
    ? targetChanged
      ? `Copy to ${saveTarget}`
      : "Update firmware"
    : "Save to repo";

  const canConnect =
    payload !== null && connectStatus === "disconnected" && !flashing;
  const canUpdate =
    connectStatus === "connected" && payload !== null && !flashing;

  const progressRatio =
    flashProgress.total > 0
      ? Math.min(1, flashProgress.done / flashProgress.total)
      : 0;
  const progressPct = Math.round(progressRatio * 100);

  const prodCount = catalogue.filter((f) => f.target === "production").length;
  const betaCount = catalogue.filter((f) => f.target === "beta").length;
  const filteredCatalogue =
    targetFilter === "all"
      ? catalogue
      : catalogue.filter((f) => f.target === targetFilter);

  return (
    <div
      className="min-h-screen animate-cba-fade-in"
      style={{ background: "#f5f2ec" }}
    >
      <SuccessBurst trigger={burstTrigger} />
      <AdminHeader flashing={flashing} />

      <div
        className="mx-auto grid max-w-[1200px] items-start px-[7vw]"
        style={{
          gridTemplateColumns: "1fr 1px 480px",
          minHeight: "calc(100vh - 130px)",
        }}
      >
        <div className="flex flex-col pb-20 pr-12 pt-9">
          <div className="mb-7 border-b border-black/10 pb-7">
            <SectionLabel>1. Load firmware file</SectionLabel>
            <label
              className="flex cursor-pointer items-center justify-center gap-2.5 px-6 py-5 text-[15px] font-bold transition-[border-color,background] duration-200"
              style={{
                border: `2px dashed ${dragging ? GOLD : file ? "#000" : "rgba(0,0,0,0.2)"}`,
                background: dragging
                  ? "rgba(186,142,81,0.12)"
                  : file
                    ? "rgba(186,142,81,0.06)"
                    : "var(--color-cream)",
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (flashing) return;
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (flashing) return;
                e.dataTransfer.dropEffect = "copy";
                if (!dragging) setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragging(false);
                if (flashing) return;
                const picked = e.dataTransfer.files?.[0] ?? null;
                if (!picked) return;
                if (!/\.(bin|hex)$/i.test(picked.name)) {
                  setParseError("File must be .bin or .hex");
                  return;
                }
                void handleFile(picked);
              }}
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke={file ? GOLD : "rgba(0,0,0,0.3)"}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span
                className="max-w-[280px] truncate"
                style={{ color: file ? "#000" : "rgba(0,0,0,0.4)" }}
              >
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
              <p className="mt-2 text-sm font-semibold text-red">
                Could not parse file: {parseError}
              </p>
            )}
            {file && (
              <div className="mt-2.5 flex items-center gap-2.5">
                <div
                  className="flex-1 border px-3 py-2 font-mono text-[12px]"
                  style={{
                    borderColor: "rgba(0,0,0,0.1)",
                    background: "rgba(0,0,0,0.02)",
                    color: "rgba(0,0,0,0.5)",
                  }}
                >
                  {file.name} · {(file.size / 1024).toFixed(1)} KB
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[12px] font-bold text-black/35 underline underline-offset-[3px]"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div
            className="mb-7 border-b border-black/10 pb-7 transition-opacity duration-300"
            style={{ opacity: file ? 1 : 0.4 }}
          >
            <SectionLabel>2. Connect &amp; flash</SectionLabel>
            <div
              key={
                flashing
                  ? "flashing"
                  : errored
                    ? "error"
                    : flashDone
                      ? "complete"
                      : "idle"
              }
              className="animate-tab-fade"
            >
              {!flashActive && (
                <>
                  <div className="flex flex-wrap gap-2.5">
                    <CbaButton
                      disabled={!canConnect}
                      onClick={handleConnect}
                      style={{ width: 170 }}
                    >
                      {connectStatus === "connecting"
                        ? "Connecting…"
                        : connectStatus === "connected"
                          ? "Connected ✓"
                          : "Connect"}
                    </CbaButton>
                    <CbaButton
                      disabled={!canUpdate}
                      variant={canUpdate ? "success" : "default"}
                      onClick={handleUpdate}
                      style={{ width: 170 }}
                    >
                      Update
                    </CbaButton>
                  </div>
                  {connectStatus === "connected" && (
                    <p className="mt-2.5 text-[12px] font-bold text-green">
                      Device connected — ready to update.
                    </p>
                  )}
                  {connectError && (
                    <p className="mt-2.5 text-sm font-semibold text-red">
                      {connectError}
                    </p>
                  )}
                </>
              )}
              {flashing && (
                <div className="flex max-w-[360px] flex-col gap-2.5">
                  <progress
                    value={progressPct}
                    max={100}
                    className="block h-[6px] w-full appearance-none border-none [&::-webkit-progress-bar]:bg-black/10"
                  />
                  <style>{`progress::-webkit-progress-value{background:${GOLD};transition:width .4s ease;}progress::-moz-progress-bar{background:${GOLD};}`}</style>
                  <div className="animate-cba-pulse text-[14px] font-bold text-green">
                    {flashStatus === "preparing"
                      ? (flashMessage ?? "Preparing…")
                      : `Uploading… ${progressPct}%`}
                  </div>
                </div>
              )}
              {errored && (
                <div className="flex max-w-[360px] flex-col gap-2.5">
                  <progress
                    value={progressPct}
                    max={100}
                    className="block h-[6px] w-full appearance-none border-none [&::-webkit-progress-bar]:bg-black/10"
                  />
                  <style>{`progress::-webkit-progress-value{background:var(--color-red);transition:width .4s ease;}progress::-moz-progress-bar{background:var(--color-red);}`}</style>
                  <p className="text-[14px] font-bold text-red">
                    {flashError ?? "Flash failed"}
                  </p>
                  <CbaButton
                    size="sm"
                    onClick={handleFlashAgain}
                    style={{ width: 160 }}
                  >
                    Try again
                  </CbaButton>
                </div>
              )}
              {flashDone && (
                <div className="flex max-w-[360px] flex-col gap-2.5">
                  <p className="text-[14px] font-bold text-green">
                    Flash complete.
                  </p>
                  <CbaButton
                    size="sm"
                    onClick={handleFlashAgain}
                    style={{ width: 160 }}
                  >
                    Flash again
                  </CbaButton>
                </div>
              )}
            </div>
          </div>

          <div
            className="transition-opacity duration-300"
            style={{ opacity: file ? 1 : 0.4 }}
          >
            <SectionLabel>
              3.{" "}
              {isEditing
                ? targetChanged
                  ? `Copy to ${saveTarget}`
                  : "Update firmware"
                : "Save to repo"}
              {!isEditing && (
                <span className="font-medium normal-case tracking-normal text-black/30">
                  {" "}
                  (optional)
                </span>
              )}
            </SectionLabel>
            {isEditing && editingEntry && (
              <div
                className="mb-3.5 flex min-h-[88px] max-w-[360px] items-start justify-between gap-3 border-2 px-3 py-2"
                style={{
                  borderColor: editingEntry.bgColor,
                  background: `${editingEntry.bgColor}14`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-[1.4]">
                    {targetChanged
                      ? `Copying "${editingEntry.name}"`
                      : `Editing "${editingEntry.name}"`}
                    <span className="font-normal text-black/60">
                      {" "}
                      {targetChanged
                        ? `(${editingEntry.target} → ${saveTarget})`
                        : `in ${editingEntry.target}`}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] leading-[1.5] text-black/55">
                    {targetChanged
                      ? "The original stays put — a new entry is created in the destination."
                      : "Saving overwrites the existing file and metadata."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[0.08em] text-black/55 underline underline-offset-[3px]"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex max-w-[360px] flex-col gap-3.5">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/[0.38]">
                  Name
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. MOOD MKII v1.2"
                  className="w-full border-2 border-black bg-cream px-3 py-2.5 text-[15px] font-bold outline-none"
                />
                {isEditing && (
                  <p className="mt-1 text-[11px] text-black/45">
                    Filename stays as{" "}
                    <span className="font-mono">{editingEntry?.filename}</span>.
                    To rename, delete the entry and re-upload.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/[0.38]">
                  Description{" "}
                  <span className="font-normal normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Brief changelog"
                  className="w-full border-2 border-black bg-cream px-3 py-2.5 text-[15px] font-bold outline-none"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/[0.38]">
                    Accent color
                  </label>
                  <div className="flex items-center gap-2.5">
                    <input
                      type="color"
                      value={saveBgColor}
                      onChange={(e) => setSaveBgColor(e.target.value)}
                      className="h-9 w-10 cursor-pointer border-2 border-black bg-cream p-0.5"
                    />
                    <span className="font-mono text-[12px] font-bold text-black/50">
                      {saveBgColor}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/[0.38]">
                    Target
                  </label>
                  <div className="flex gap-4">
                    {(["beta", "production"] as const).map((t) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-bold"
                      >
                        <input
                          type="radio"
                          name="saveTarget"
                          value={t}
                          checked={saveTarget === t}
                          onChange={() => setSaveTarget(t)}
                          style={{ accentColor: "#000" }}
                        />
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="relative flex items-center gap-4">
                <CbaButton
                  disabled={!canSave}
                  onClick={handleSave}
                  style={{ width: 200 }}
                >
                  {saveStatus === "saving" ? "Saving…" : saveButtonLabel}
                </CbaButton>
                {duplicateInTarget && (
                  <div
                    role="alert"
                    className="animate-tab-fade absolute left-0 top-full z-20 mt-2 w-[280px] border-2 border-black bg-cream px-3 py-2 shadow-cba"
                  >
                    <p className="text-[12px] font-bold leading-[1.4]">
                      Already in {saveTarget} as{" "}
                      <span className="font-mono">{file?.name}</span>.
                    </p>
                    <p className="mt-0.5 text-[11px] text-black/55">
                      Delete the existing entry or switch target to save.
                    </p>
                  </div>
                )}
                {!duplicateInTarget && saveMessage && (
                  <p
                    className={`max-w-[200px] text-[13px] font-bold leading-[1.4] ${saveStatus === "error" ? "text-red" : "text-green"}`}
                  >
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="self-stretch bg-black/[0.09]" />

        <div className="pb-20 pl-9 pt-9">
          <div className="mb-5 flex items-center justify-between">
            <SectionLabel className="mb-0">In-repo firmwares</SectionLabel>
            <button
              type="button"
              onClick={() => void loadCatalogues()}
              className="cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[0.1em] text-black/35 underline underline-offset-[3px]"
            >
              Refresh
            </button>
          </div>

          <div className="mb-4 flex gap-2">
            {[
              {
                id: "all" as const,
                label: "All",
                count: catalogue.length,
                color: "rgba(0,0,0,0.6)",
              },
              {
                id: "production" as const,
                label: "Production",
                count: prodCount,
                color: "var(--color-green)",
              },
              {
                id: "beta" as const,
                label: "Beta",
                count: betaCount,
                color: GOLD,
              },
            ].map((p) => {
              const active = targetFilter === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTargetFilter(p.id)}
                  aria-pressed={active}
                  className={`flex cursor-pointer items-center gap-1.5 border bg-cream px-2.5 py-1 transition-[border-color,background] duration-150 ${
                    active
                      ? "border-black"
                      : "border-black/[0.12] hover:border-black/30"
                  }`}
                  style={active ? { background: "#fefbf6" } : undefined}
                >
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: p.color, opacity: active ? 1 : 0.6 }}
                  >
                    {p.label}
                  </span>
                  <span
                    className="text-[10px] font-bold"
                    style={{ color: active ? "#000" : "rgba(0,0,0,0.35)" }}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>

          <table
            data-no-trail
            className="w-full table-fixed border-collapse border-y-2 border-r-2 border-black bg-cream"
          >
            <colgroup>
              <col />
              <col style={{ width: "170px" }} />
            </colgroup>
            <thead>
              <tr className="border-b-2 border-black bg-black/[0.03]">
                {["Firmware", ""].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={`py-2 text-left text-[9px] font-bold uppercase tracking-[0.12em] text-black/35 ${
                      i === 0
                        ? "border-l-2 border-black pl-3.5 pr-3.5"
                        : "px-3.5"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogueLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr
                    key={`skel-${i}`}
                    className="animate-cba-pulse"
                    style={{
                      borderBottom:
                        i < 2 ? "1px solid rgba(0,0,0,0.07)" : "none",
                    }}
                  >
                    <td
                      className="relative px-3.5 py-3 align-middle"
                      style={{ borderLeft: "2px solid rgba(0,0,0,0.1)" }}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 w-[2px]"
                        style={{
                          top: -1,
                          bottom: -1,
                          background: "rgba(0,0,0,0.1)",
                          zIndex: 1,
                        }}
                      />
                      <div className="flex flex-col gap-1.5">
                        <div className="h-[10px] w-16 bg-black/10" />
                        <div className="h-3.5 w-40 bg-black/10" />
                        <div className="h-3 w-48 bg-black/10" />
                      </div>
                    </td>
                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex justify-end gap-1.5">
                        <div className="h-[26px] w-14 bg-black/10" />
                        <div className="h-[26px] w-14 bg-black/10" />
                      </div>
                    </td>
                  </tr>
                ))}
              {catalogueError && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-6 py-6 text-center text-sm font-semibold text-red"
                  >
                    Could not load: {catalogueError}
                  </td>
                </tr>
              )}
              {!catalogueLoading &&
                !catalogueError &&
                filteredCatalogue.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-6 py-6 text-center text-[14px] text-black/35"
                    >
                      {catalogue.length === 0
                        ? "Nothing uploaded yet."
                        : `No ${targetFilter} firmwares.`}
                    </td>
                  </tr>
                )}
              {!catalogueLoading &&
                !catalogueError &&
                filteredCatalogue.map((fw, i) => {
                  const key = `${fw.target}:${fw.filename}`;
                  const busy = deleting === key;
                  const isBeta = fw.target === "beta";
                  const status = deployStatus[key] ?? "checking";
                  const dotColor =
                    status === "live"
                      ? "var(--color-green)"
                      : status === "pending"
                        ? "var(--color-red)"
                        : "rgba(0,0,0,0.2)";
                  const dotTitle =
                    status === "live"
                      ? "Live on the CDN"
                      : status === "pending"
                        ? "Uploaded — waiting for next Vercel deploy"
                        : "Checking…";
                  return (
                    <tr
                      key={key}
                      className="transition-opacity duration-200"
                      style={{
                        opacity: busy ? 0.4 : 1,
                        background: busy ? "rgba(0,0,0,0.02)" : undefined,
                        borderBottom:
                          i < filteredCatalogue.length - 1
                            ? "1px solid rgba(0,0,0,0.07)"
                            : "none",
                      }}
                    >
                      <td
                        className="relative px-3.5 py-3 align-middle"
                        style={{
                          borderLeft: `2px solid ${fw.bgColor}`,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0 w-[2px]"
                          style={{
                            top: -1,
                            bottom: -1,
                            background: fw.bgColor,
                            zIndex: 1,
                          }}
                        />
                        <div className="flex min-w-0 flex-col gap-1 pr-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              aria-label={dotTitle}
                              title={dotTitle}
                              className="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
                              style={{ background: dotColor }}
                            />
                            <span
                              className="text-[9px] font-bold uppercase tracking-[0.1em]"
                              style={{
                                color: isBeta ? GOLD : "var(--color-green)",
                              }}
                            >
                              {fw.target}
                            </span>
                          </div>
                          <span
                            title={fw.name}
                            className="truncate text-[14px] font-bold"
                          >
                            {fw.name}
                          </span>
                          <span
                            title={fw.filename}
                            className="truncate font-mono text-[11px] text-black/45"
                          >
                            {fw.filename}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleLoadFromRepo(fw)}
                            disabled={busy || status !== "live" || flashing}
                            title={
                              status !== "live"
                                ? "Available once deployed"
                                : "Load into flasher"
                            }
                            className="cursor-pointer border border-black bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black transition-colors duration-150 hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(fw)}
                            disabled={busy}
                            className="cursor-pointer border border-red bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-red transition-colors duration-150 hover:bg-red hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? "…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <p className="mt-3.5 text-[12px] leading-[1.6] text-black/30">
            Changes committed via Save to repo are visible after the next Vercel
            deploy.
          </p>
        </div>
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
