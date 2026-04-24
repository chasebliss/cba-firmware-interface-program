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
import { formatRelativeTime } from "@/lib/format";

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
  uploadedAt?: string;
  active?: boolean;
}

interface AdminFirmware {
  name: string;
  filename: string;
  target: "production" | "beta";
  bgColor: string;
  description: string;
  uploadedAt: string | null;
  active: boolean;
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
  // Cached per-section counts from the last successful load, persisted in
  // localStorage so the skeleton mirrors the real layout (Production section
  // + Beta section, each with the right number of rows) on first render.
  const [cachedCounts, setCachedCounts] = useState<{
    production: number;
    beta: number;
  }>(() => {
    if (typeof window === "undefined") return { production: 2, beta: 1 };
    try {
      const raw = window.localStorage.getItem("cba-admin-firmware-counts");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          production?: number;
          beta?: number;
        };
        if (
          typeof parsed.production === "number" &&
          typeof parsed.beta === "number"
        ) {
          return { production: parsed.production, beta: parsed.beta };
        }
      }
    } catch {
      // fall through to default
    }
    return { production: 2, beta: 1 };
  });
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  // Per-row deploy state: "live" once the file is served by the CDN, "pending"
  // if we got a 404 (uploaded but Vercel hasn't redeployed yet), "checking"
  // while the HEAD probe is in flight.
  const [deployStatus, setDeployStatus] = useState<
    Record<string, "checking" | "live" | "pending">
  >({});

  const refreshTokenRef = useRef(0);
  const loadCatalogues = async () => {
    const token = ++refreshTokenRef.current;
    setCatalogueLoading(true);
    setCatalogueError(null);
    try {
      const resp = await fetch(`/api/admin/list-firmwares?t=${token}`, {
        cache: "no-store",
      });
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
          uploadedAt: e.uploadedAt ?? null,
          active: e.active !== false,
        }));
      const merged = [
        ...toAdmin(data.production, "production"),
        ...toAdmin(data.beta, "beta"),
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
      setCatalogue(merged);
      const nextCounts = {
        production: merged.filter((m) => m.target === "production").length,
        beta: merged.filter((m) => m.target === "beta").length,
      };
      setCachedCounts(nextCounts);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "cba-admin-firmware-counts",
          JSON.stringify(nextCounts),
        );
      }
      void probeDeployStatus(merged);
    } catch (err) {
      setCatalogueError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogueLoading(false);
    }
  };

  const probeDeployStatus = async (entries: AdminFirmware[]) => {
    const token = refreshTokenRef.current;
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
        const url = `${base}${entry.filename}?t=${token}`;
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

  // Auto-re-probe pending rows every 10s — so when Vercel finishes a redeploy
  // the red dots flip green without the admin having to click Refresh. Stops
  // itself the moment nothing is pending.
  useEffect(() => {
    const pending = catalogue.filter(
      (e) => deployStatus[`${e.target}:${e.filename}`] === "pending",
    );
    if (pending.length === 0) return;
    const id = window.setInterval(() => {
      void probeDeployStatus(pending);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [catalogue, deployStatus]);

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
          `Overwrite "${editingEntry.name}" in ${editingEntry.target}? Users will see the new version once the site finishes updating.`,
        );
        if (!ok) return;
      }
    }
    setSaveStatus("saving");
    setSaveMessage(null);
    try {
      const buf = await file.arrayBuffer();
      const contentBase64 = arrayBufferToBase64(buf);
      // Overwrite an existing entry only when we're editing in place — same
      // target AND same filename. Copy-to-other-target (target changed) is a
      // fresh insert into the destination, not an overwrite.
      const overwrite =
        editingEntry !== null &&
        editingEntry.target === saveTarget &&
        editingEntry.filename === file.name;
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
          overwrite,
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

  // Flip active on a manifest entry. Hidden entries stay in the admin list
  // but disappear from the public /  and /beta dropdowns (Programmer filters
  // on active before rendering).
  const [toggling, setToggling] = useState<string | null>(null);
  const handleToggleActive = async (entry: AdminFirmware) => {
    const nextActive = !entry.active;
    setToggling(`${entry.target}:${entry.filename}`);
    try {
      const resp = await fetch("/api/admin/update-firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: entry.filename,
          target: entry.target,
          patch: { active: nextActive },
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!resp.ok) {
        window.alert(
          `${nextActive ? "Show" : "Hide"} failed: ${data.error ?? resp.status}`,
        );
        return;
      }
      await loadCatalogues();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    } finally {
      setToggling(null);
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
    : "Save firmware";

  const canConnect =
    payload !== null && connectStatus === "disconnected" && !flashing;
  const canUpdate =
    connectStatus === "connected" && payload !== null && !flashing;

  const progressRatio =
    flashProgress.total > 0
      ? Math.min(1, flashProgress.done / flashProgress.total)
      : 0;
  const progressPct = Math.round(progressRatio * 100);

  // Active first, disabled sink to the bottom of their section. Within each
  // active/disabled bucket: newest upload first, tiebreak alphabetically so
  // the order is stable across loads.
  const sortForSection = (a: AdminFirmware, b: AdminFirmware) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const at = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bt = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    if (at !== bt) return bt - at;
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  };
  const productionRows = catalogue
    .filter((f) => f.target === "production")
    .sort(sortForSection);
  const betaRows = catalogue
    .filter((f) => f.target === "beta")
    .sort(sortForSection);

  return (
    <div className="min-h-screen animate-cba-fade-in bg-gray-50">
      <SuccessBurst trigger={burstTrigger} />
      <AdminHeader flashing={flashing} />

      <div
        className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-8 px-[7vw] md:grid-cols-[1fr_1px_1fr] md:gap-0"
        style={{ minHeight: "calc(100vh - 130px)" }}
      >
        <div className="flex flex-col pb-8 pt-9 md:pb-20 md:pr-12">
          <div className="mb-7 border-b border-black/10 pb-7">
            <SectionLabel>1. Load firmware file</SectionLabel>
            <label
              className="flex  cursor-pointer items-center justify-center gap-2.5 px-6 py-5 text-[15px] font-bold transition-[border-color,background] duration-200"
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
                  <div className="flex gap-2.5">
                    <CbaButton
                      disabled={!canConnect}
                      variant={
                        connectStatus === "connected" ? "success" : "default"
                      }
                      onClick={handleConnect}
                      fullWidth
                      className="flex-1"
                      style={{
                        opacity: connectStatus === "connected" ? 1 : undefined,
                      }}
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
                      fullWidth
                      className="flex-1"
                    >
                      Update
                    </CbaButton>
                  </div>
                  {connectError && (
                    <p className="mt-2.5 text-sm font-semibold text-red">
                      {connectError}
                    </p>
                  )}
                </>
              )}
              {flashing && (
                <div className="flex flex-col items-center gap-2.5">
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
                <div className="flex flex-col items-center gap-2.5">
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
                <div className="flex flex-col items-center gap-2.5">
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
                : "Save firmware"}
              {!isEditing && (
                <span className="font-medium normal-case tracking-normal text-black/30">
                  {" "}
                  (optional)
                </span>
              )}
            </SectionLabel>
            {isEditing && editingEntry && (
              <div
                className="mb-3.5 flex min-h-[88px]  items-start justify-between gap-3 border-2 px-3 py-2"
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
            <div className="flex  flex-col gap-3.5">
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
              <div className="relative mt-10 flex items-center gap-4">
                <CbaButton disabled={!canSave} onClick={handleSave} fullWidth>
                  {saveStatus === "saving" ? "Saving…" : saveButtonLabel}
                </CbaButton>
                {duplicateInTarget && (
                  <div
                    role="alert"
                    className="animate-tab-fade absolute left-1/2 top-full z-20 mt-2 w-[280px] -translate-x-1/2 border-2 border-black bg-cream px-3 py-2 shadow-cba"
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

        <div className="hidden bg-black/[0.09] md:block md:self-stretch" />

        <div className="pb-20 pt-0 md:pl-9 md:pt-9">
          <div className="mb-5">
            <SectionLabel className="mb-0">Saved firmwares</SectionLabel>
          </div>

          <div data-no-trail className="flex flex-col gap-6">
            {catalogueLoading &&
              (
                [
                  {
                    label: "Production",
                    color: "var(--color-green)",
                    count: cachedCounts.production,
                  },
                  {
                    label: "Beta",
                    color: GOLD,
                    count: cachedCounts.beta,
                  },
                ] as const
              )
                .filter((s) => s.count > 0)
                .map((section) => (
                  <section key={`skel-${section.label}`}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: section.color }}
                      >
                        {section.label}
                      </span>
                      <span className="text-[9px] font-bold tracking-[0.12em] text-black/35">
                        {section.count}
                      </span>
                    </div>
                    <ul className="flex flex-col">
                      {Array.from({ length: section.count }).map((_, i) => (
                        <li
                          key={i}
                          className="animate-cba-pulse relative flex items-center gap-3 bg-cream px-3.5 py-3"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute -bottom-px -top-px left-0 z-[1] w-[4px] bg-black/10"
                          />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-black/10" />
                              <div className="h-[17px] w-36 bg-black/10" />
                            </div>
                            <div className="flex items-baseline gap-2">
                              <div className="h-[13px] w-40 bg-black/10" />
                              <div className="h-[12px] w-12 shrink-0 bg-black/10" />
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <div className="h-[24px] w-[52px] border border-black/10" />
                            <div className="h-[24px] w-[66px] border border-black/10" />
                            <div className="h-[24px] w-[62px] border border-black/10" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            {catalogueError && (
              <p className="px-6 py-6 text-center text-sm font-semibold text-red">
                Could not load: {catalogueError}
              </p>
            )}
            {!catalogueLoading && !catalogueError && catalogue.length === 0 && (
              <p className="px-6 py-6 text-center text-[14px] text-black/35">
                Nothing uploaded yet.
              </p>
            )}
            {!catalogueLoading &&
              !catalogueError &&
              (
                [
                  {
                    label: "Production",
                    color: "var(--color-green)",
                    rows: productionRows,
                  },
                  {
                    label: "Beta",
                    color: GOLD,
                    rows: betaRows,
                  },
                ] as const
              )
                .filter((s) => s.rows.length > 0)
                .map((section) => (
                  <section key={section.label}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span
                        className="text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ color: section.color }}
                      >
                        {section.label}
                      </span>
                      <span className="text-[9px] font-bold tracking-[0.12em] text-black/35">
                        {section.rows.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-px">
                      {section.rows.map((fw) => {
                        const key = `${fw.target}:${fw.filename}`;
                        const busy = deleting === key;
                        const status = deployStatus[key] ?? "checking";
                        const dotColor = !fw.active
                          ? "var(--color-red)"
                          : status === "live"
                            ? "var(--color-green)"
                            : status === "pending"
                              ? "var(--color-yellow)"
                              : "rgba(0,0,0,0.2)";
                        const dotTitle = !fw.active
                          ? "Disabled — hidden from users"
                          : status === "live"
                            ? "Live for users"
                            : status === "pending"
                              ? "Saved — site is still updating"
                              : "Checking…";
                        return (
                          <li
                            key={key}
                            className="relative flex items-center gap-3 bg-cream px-3.5 py-3 transition-opacity duration-200"
                            style={{
                              opacity: busy ? 0.4 : fw.active ? 1 : 0.55,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute -bottom-px -top-px left-0 z-[1] w-[4px]"
                              style={{ background: fw.bgColor }}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  aria-label={dotTitle}
                                  title={dotTitle}
                                  className="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
                                  style={{ background: dotColor }}
                                />
                                <span
                                  title={fw.name}
                                  className="truncate text-[14px] font-bold"
                                >
                                  {fw.name}
                                </span>
                                {!fw.active && (
                                  <span
                                    title="Disabled — hidden from users, still in the admin list"
                                    className="shrink-0 border border-red/50 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.1em] text-red"
                                  >
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span
                                  title={fw.filename}
                                  className="truncate font-mono text-[11px] text-black/45"
                                >
                                  {fw.filename}
                                </span>
                                {fw.uploadedAt && (
                                  <span
                                    title={new Date(
                                      fw.uploadedAt,
                                    ).toLocaleString()}
                                    className="shrink-0 text-[10px] text-black/35"
                                  >
                                    · {formatRelativeTime(fw.uploadedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleLoadFromRepo(fw)}
                                disabled={busy || status !== "live" || flashing}
                                title={
                                  status !== "live"
                                    ? "Available once the site finishes updating"
                                    : "Load into flasher"
                                }
                                className="cursor-pointer border border-black bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black transition-colors duration-200 ease-out hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Load
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(fw)}
                                disabled={busy || toggling === key || flashing}
                                title={
                                  fw.active
                                    ? "Disable — hide from users, keep in admin"
                                    : "Enable — show to users again"
                                }
                                className="cursor-pointer border border-black/40 bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black/70 transition-colors duration-200 ease-out hover:border-black hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {toggling === key
                                  ? "…"
                                  : fw.active
                                    ? "Disable"
                                    : "Enable"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(fw)}
                                disabled={busy}
                                className="cursor-pointer border border-red bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-red transition-colors duration-200 ease-out hover:bg-red hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy ? "…" : "Delete"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
          </div>

          <ul className="mt-3.5 flex flex-col gap-1.5 text-[12px] leading-[1.6] text-black/45">
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-green"
              />
              Green — live in environment.
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-yellow"
              />
              Yellow — saved, site is still updating (usually under a 30
              seconds).
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-red"
              />
              Red — disabled, hidden from environment.
            </li>
          </ul>
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
