import { useEffect, useRef, useState } from "react";
import { AdminFirmwareDropZone } from "@/components/AdminFirmwareDropZone";
import { AdminFirmwareList } from "@/components/AdminFirmwareList";
import { AdminFlashSection } from "@/components/AdminFlashSection";
import { AdminHeader } from "@/components/AdminHeader";
import { AdminSaveForm } from "@/components/AdminSaveForm";
import { SectionLabel } from "@/components/SectionLabel";
import { SuccessBurst } from "@/components/SuccessBurst";
import {
  CHANNELS,
  DEFAULT_TRANSFER_SIZE,
  FAKE_BG_COLOR,
  FAKE_ENTRY,
  FAKE_FILENAME,
  FAKE_PAYLOAD_BYTES,
  MOCK_TARGET,
  adminCatalogueFrom,
  isRealFirmware,
  publicBaseFor,
  type AdminFirmware,
  type ConnectStatus,
  type FlashStatus,
  type ManifestEntry,
  type SaveTarget,
} from "@/lib/admin-firmware";
import { rowKey, useDeployProbe } from "@/lib/deploy-probe";
import {
  byName,
  pedalsIn,
  type FirmwarePayload,
} from "@/lib/firmware-catalogue";
import { useSaveDraft } from "@/lib/save-draft";
import {
  DfuseDevice,
  connectToFakeDevice,
  isHexPath,
  parseIntelHex,
  requestAndConnectDevice,
  type DfuLogger,
} from "@/lib/dfu";
import { arrayBufferToBase64 } from "@/lib/format";

type ConnectedDevice = Awaited<
  ReturnType<typeof requestAndConnectDevice>
>["device"];

const COUNTS_STORAGE_KEY = "cba-admin-firmware-counts-v2";

// Skeleton row counts before the first load lands. Only a first-paint guess —
// real counts replace these as soon as list-firmwares responds.
const DEFAULT_COUNTS: Partial<Record<SaveTarget, number>> = {
  production: 2,
  beta: 1,
  nightly: 1,
};

export const LocalFlasher = () => {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<FirmwarePayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const deviceRef = useRef<ConnectedDevice | null>(null);
  const transferSizeRef = useRef<number>(DEFAULT_TRANSFER_SIZE);
  const manifestationTolerantRef = useRef<boolean>(true);
  // True after Load is clicked on the FAKE_ENTRY row. handleConnect routes to
  // connectToFakeDevice() instead of the browser USB picker. Cleared by any
  // real file upload, repo Load on a real row, or removeFile.
  const [fakeDeviceMode, setFakeDeviceMode] = useState(false);
  // Opt-in: ?mock=1 surfaces the Mock Pedal row in the saved firmwares list.
  // Without it, /admin looks identical to the pre-mock UI.
  const showMockRow =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mock") === "1";

  const [connectStatus, setConnectStatus] =
    useState<ConnectStatus>("disconnected");
  const [connectError, setConnectError] = useState<string | null>(null);

  const [flashStatus, setFlashStatus] = useState<FlashStatus>("idle");
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [flashProgress, setFlashProgress] = useState({ done: 0, total: 0 });
  const [flashError, setFlashError] = useState<string | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);

  // Fields, edit mode, dirty-checking and save status all live in the draft
  // module — see src/lib/save-draft.ts.
  const draft = useSaveDraft();

  const [catalogue, setCatalogue] = useState<AdminFirmware[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  // Cached per-section counts from the last successful load, persisted in
  // localStorage so the skeleton mirrors the real layout (one section per
  // channel, each with the right number of rows) on first render. Storage key
  // is versioned — v2 dropped the fixed {production, beta} shape for a
  // per-channel record, and a stale v1 value would fail validation anyway.
  const [cachedCounts, setCachedCounts] = useState<
    Partial<Record<SaveTarget, number>>
  >(() => {
    if (typeof window === "undefined") return DEFAULT_COUNTS;
    try {
      const raw = window.localStorage.getItem(COUNTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const counts: Partial<Record<SaveTarget, number>> = {};
        for (const channel of CHANNELS) {
          const v = parsed[channel.id];
          if (typeof v === "number") counts[channel.id] = v;
        }
        if (Object.keys(counts).length > 0) return counts;
      }
    } catch {
      // fall through to default
    }
    return DEFAULT_COUNTS;
  });
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  // Row keys of in-flight mutations, so the affected row can dim and disable
  // its buttons while the API call runs.
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  // Per-row CDN deploy state ("live" / "pending" / "checking") — owned by the
  // probe module, see src/lib/deploy-probe.ts.
  const deploy = useDeployProbe();

  const refreshTokenRef = useRef(0);
  const loadCatalogues = async () => {
    const token = ++refreshTokenRef.current;
    setCatalogueLoading(true);
    setCatalogueError(null);
    try {
      const resp = await fetch(`/api/admin/list-firmwares?t=${token}`, {
        cache: "no-store",
      });
      const data = (await resp.json().catch(() => ({}))) as Partial<
        Record<SaveTarget, ManifestEntry[]>
      > & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      const merged = adminCatalogueFrom(data);
      setCatalogue(merged);
      const nextCounts = Object.fromEntries(
        CHANNELS.map((channel) => [
          channel.id,
          merged.filter((m) => m.target === channel.id).length,
        ]),
      ) as Partial<Record<SaveTarget, number>>;
      setCachedCounts(nextCounts);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          COUNTS_STORAGE_KEY,
          JSON.stringify(nextCounts),
        );
      }
      deploy.probe(merged);
    } catch (err) {
      setCatalogueError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogueLoading(false);
    }
  };

  useEffect(() => {
    // Deferred by a frame so the first load doesn't set state synchronously
    // during the effect, which would cascade an extra render on mount.
    // `catalogueLoading` already starts true, so the skeleton paints either way.
    const id = window.setTimeout(() => void loadCatalogues(), 0);
    return () => window.clearTimeout(id);
    // loadCatalogues is redefined every render and this must run once on
    // mount; the refresh token inside it guards against overlapping loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setFakeDeviceMode(false);
    if (!picked) return;
    if (!/\.(bin|hex)$/i.test(picked.name)) {
      setParseError("File must be .bin or .hex");
      return;
    }
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

  const handleLoadFakePedal = () => {
    if (draft.isDirty()) {
      const ok = window.confirm(
        "You have unsaved changes in the save form. Load the mock and discard them?",
      );
      if (!ok) return;
    }
    const buffer = new ArrayBuffer(FAKE_PAYLOAD_BYTES);
    const synthetic = new File([buffer], FAKE_FILENAME, {
      type: "application/octet-stream",
    });
    setParseError(null);
    setFile(synthetic);
    setPayload({ kind: "bin", buffer });
    setFakeDeviceMode(true);
    // Don't prefill the save form — the mock isn't saveable.
    draft.reset();
  };

  const handleLoadFromRepo = async (entry: AdminFirmware) => {
    if (entry.filename === FAKE_FILENAME) {
      handleLoadFakePedal();
      return;
    }
    if (draft.isDirty()) {
      const ok = window.confirm(
        "You have unsaved changes in the save form. Load this firmware and discard them?",
      );
      if (!ok) return;
    }
    if (!isRealFirmware(entry)) return;
    const base = publicBaseFor(entry.target);
    const url = `${base}${entry.filename}`;
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const picked = new File([blob], entry.filename, { type: blob.type });
      await handleFile(picked);
      draft.beginEdit(entry);
    } catch (err) {
      setParseError(
        `Could not load ${entry.filename}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleRemoveFile = () => {
    if (draft.isDirty()) {
      const ok = window.confirm(
        "You have unsaved changes. Remove the loaded file and discard them?",
      );
      if (!ok) return;
    }
    setFile(null);
    setPayload(null);
    setParseError(null);
    setFakeDeviceMode(false);
    setFlashStatus("idle");
    setFlashMessage(null);
    setFlashError(null);
    setFlashProgress({ done: 0, total: 0 });
    draft.reset();
  };

  // Used by the save-form Cancel button when in edit mode, and by "Save to
  // repo" success to return to a fresh state.
  const handleCancelEdit = () => {
    if (draft.isDirty()) {
      const ok = window.confirm(
        "Discard unsaved changes to this firmware's metadata?",
      );
      if (!ok) return;
    }
    draft.reset();
  };

  const handleConnect = async () => {
    setConnectError(null);
    setConnectStatus("connecting");
    try {
      const result = fakeDeviceMode
        ? await connectToFakeDevice()
        : await requestAndConnectDevice();
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
    const { editingEntry, fields } = draft;
    // Destructive overwrite confirmation: the row is edited-in-place AND it's
    // already live on the CDN, so users could briefly see the new file as soon
    // as the next Vercel deploy lands.
    if (editingEntry && editingEntry.target === fields.target) {
      if (deploy.status[rowKey(editingEntry)] === "live") {
        const ok = window.confirm(
          `Overwrite "${editingEntry.name}" in ${editingEntry.target}? Users will see the new version once the site finishes updating.`,
        );
        if (!ok) return;
      }
    }
    draft.beginSave();
    try {
      const buf = await file.arrayBuffer();
      const contentBase64 = arrayBufferToBase64(buf);
      // Overwrite an existing entry only when we're editing in place — same
      // target AND same filename. Copy-to-other-target (target changed) is a
      // fresh insert into the destination, not an overwrite.
      const overwrite =
        editingEntry !== null &&
        editingEntry.target === fields.target &&
        editingEntry.filename === file.name;
      const resp = await fetch("/api/admin/upload-firmware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentBase64,
          target: fields.target,
          name: fields.name.trim(),
          pedal: fields.pedal.trim(),
          description: fields.description.trim(),
          internalNotes: fields.internalNotes.trim(),
          bgColor: fields.bgColor,
          overwrite,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        commitUrl?: string;
      };
      if (!resp.ok) {
        draft.failSave(data.error ?? `Upload failed (${resp.status})`);
        return;
      }
      setFile(null);
      setPayload(null);
      setParseError(null);
      setFlashStatus("idle");
      setFlashMessage(null);
      setFlashError(null);
      setFlashProgress({ done: 0, total: 0 });
      draft.reset();
      void loadCatalogues();
    } catch (err) {
      draft.failSave(err instanceof Error ? err.message : String(err));
    }
  };

  // Flip active on a manifest entry. Hidden entries stay in the admin list
  // but disappear from the public /  and /beta dropdowns (Programmer filters
  // on active before rendering).
  const handleToggleActive = async (entry: AdminFirmware) => {
    const nextActive = !entry.active;
    setToggling(rowKey(entry));
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
          `${nextActive ? "List" : "Unlist"} failed: ${data.error ?? resp.status}`,
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
        `Permanently delete ${entry.name} (${entry.filename}) from ${entry.target}?\n\nIt's already unlisted, so it's off the site. This removes the archived copy too, so it can't be restored from here.`,
      )
    ) {
      return;
    }
    setDeleting(rowKey(entry));
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

  // Conflict in the destination target. If we're editing in place (target
  // unchanged) the match is self — not a conflict. If we've flipped the target
  // radio (copy) the match is a real conflict that should block the save.
  const duplicateInTarget =
    file !== null &&
    catalogue.some(
      (e) =>
        e.target === draft.fields.target &&
        e.filename === file.name &&
        !(
          draft.editingEntry &&
          draft.editingEntry.target === e.target &&
          draft.editingEntry.filename === e.filename
        ),
    );
  // Every distinct pedal already in any channel, so the admin picks from
  // what exists instead of retyping it. Free text let "BIG TIME" and
  // "BIGTIME" both in, which split one product's history in two.
  const knownPedals = pedalsIn(catalogue.filter(isRealFirmware));

  const canSave =
    file !== null &&
    draft.complete &&
    draft.status !== "saving" &&
    !flashing &&
    !duplicateInTarget;

  const canConnect =
    payload !== null && connectStatus === "disconnected" && !flashing;
  const canUpdate =
    connectStatus === "connected" && payload !== null && !flashing;

  // Alphabetical, unlisted rows included — a row is findable by name, and
  // the Unlisted chip already marks the exceptions.
  // One section per channel, in registry order. The mock (when enabled) gets
  // its own trailing section rather than squatting in a real channel's list.
  const sections = [
    ...CHANNELS.map((channel) => ({
      id: channel.id as string,
      label: channel.label,
      color: channel.color,
      route: channel.route,
      rows: catalogue
        .filter((f) => f.target === channel.id)
        .sort(byName),
    })),
    ...(showMockRow
      ? [
          {
            id: MOCK_TARGET as string,
            label: "Mock",
            color: FAKE_BG_COLOR,
            rows: [FAKE_ENTRY],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen animate-cba-fade-in bg-surface-2">
      <SuccessBurst trigger={burstTrigger} />
      <AdminHeader flashing={flashing} />

      <div
        className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-8 px-[7vw] md:grid-cols-[1fr_1px_1fr] md:gap-0"
        style={{ minHeight: "calc(100vh - 130px)" }}
      >
        <div className="flex flex-col pb-8 pt-9 md:pb-20 md:pr-12">
          <div className="mb-7 border-b border-border/10 pb-7">
            <SectionLabel>1. Load firmware file</SectionLabel>
            <AdminFirmwareDropZone
              file={file}
              parseError={parseError}
              disabled={flashing}
              onPick={handleFile}
              onRemove={handleRemoveFile}
            />
          </div>

          <AdminFlashSection
            hasFile={file !== null}
            connectStatus={connectStatus}
            connectError={connectError}
            flashStatus={flashStatus}
            flashMessage={flashMessage}
            flashError={flashError}
            flashProgress={flashProgress}
            canConnect={canConnect}
            canUpdate={canUpdate}
            onConnect={handleConnect}
            onUpdate={handleUpdate}
            onFlashAgain={handleFlashAgain}
          />

          <AdminSaveForm
            draft={draft}
            file={file}
            knownPedals={knownPedals}
            duplicateInTarget={duplicateInTarget}
            canSave={canSave}
            onSave={handleSave}
            onCancelEdit={handleCancelEdit}
          />
        </div>

        <div className="hidden bg-text/9 md:block md:self-stretch" />

        <AdminFirmwareList
          loading={catalogueLoading}
          error={catalogueError}
          showMockRow={showMockRow}
          catalogueEmpty={catalogue.length === 0}
          cachedCounts={cachedCounts}
          sections={sections}
          deployStatus={deploy.status}
          deleting={deleting}
          toggling={toggling}
          flashing={flashing}
          onLoad={handleLoadFromRepo}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
};
