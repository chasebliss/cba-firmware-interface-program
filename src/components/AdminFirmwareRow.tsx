import {
  channelFor,
  DEPLOY_STATUS_HELP,
  DEPLOY_STATUS_LABEL,
  FAKE_BG_COLOR,
  FAKE_FILENAME,
  isRealFirmware,
  listingHelp,
  type AdminFirmware,
  type DeployStatus,
} from "@/lib/admin-firmware";
import { formatRelativeTime } from "@/lib/format";

interface AdminFirmwareRowProps {
  firmware: AdminFirmware;
  status: DeployStatus | undefined;
  busy: boolean;
  toggling: boolean;
  flashing: boolean;
  onLoad: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

export const AdminFirmwareRow = ({
  firmware,
  status: rawStatus,
  busy,
  toggling,
  flashing,
  onLoad,
  onToggleActive,
  onDelete,
}: AdminFirmwareRowProps) => {
  const isFake = firmware.filename === FAKE_FILENAME;
  const status = rawStatus ?? "checking";
  // Derived from the row's own target rather than passed down — the label is a
  // property of the channel, and the row already knows which channel it's in.
  const channelLabel = isRealFirmware(firmware)
    ? (channelFor(firmware.target)?.label ?? firmware.target)
    : "";

  // Publish progress — one axis. Colour is a secondary cue behind the word,
  // never the only signal, and it never encodes listing state.
  const publishColor =
    status === "live"
      ? "var(--color-green)"
      : status === "pending"
        ? "var(--color-gold)"
        : "rgba(0,0,0,0.25)";

  return (
    <li
      className="relative flex items-center gap-3 bg-cream px-3.5 py-3 transition-opacity duration-200"
      style={{
        opacity: busy ? 0.4 : firmware.active ? 1 : 0.55,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-px -top-px left-0 z-1 w-[4px]"
        style={{ background: firmware.bgColor }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {isFake && (
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: FAKE_BG_COLOR }}
            />
          )}
          <span
            title={firmware.name}
            className="truncate text-[14px] font-bold"
          >
            {firmware.name}
          </span>
          {/* Only exceptions get a chip. On-site and in the picker is the
              resting state of almost every row, so labelling it would make the
              commonest case the loudest thing on screen. Silence means normal;
              a chip means something is mid-flight or deliberately held back.
              Each chip's tooltip explains itself, so no legend is needed. */}
          {!isFake && firmware.active && status === "pending" && (
            <span
              title={DEPLOY_STATUS_HELP[status]}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gold/12 px-2 py-px text-[9px] font-bold uppercase tracking-[0.08em] text-gold"
            >
              <span
                aria-hidden="true"
                className="animate-cba-pulse h-1 w-1 shrink-0 rounded-full"
                style={{ background: publishColor }}
              />
              {DEPLOY_STATUS_LABEL[status]}
            </span>
          )}
          {!isFake && !firmware.active && (
            <span
              title={listingHelp(false, channelLabel)}
              className="shrink-0 whitespace-nowrap rounded-full bg-black/8 px-2 py-px text-[9px] font-bold uppercase tracking-[0.08em] text-black/55"
            >
              Unlisted
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span
            title={firmware.filename}
            className="truncate font-mono text-[11px] text-black/45"
          >
            {firmware.filename}
          </span>
          {(() => {
            // Show last edit (updatedAt) for admin verification. Falls back to
            // uploadedAt for older rows that pre-date the field.
            const ts = firmware.updatedAt ?? firmware.uploadedAt;
            if (!ts) return null;
            return (
              <span
                title={new Date(ts).toLocaleString()}
                className="shrink-0 text-[10px] text-black/35"
              >
                · {formatRelativeTime(ts)}
              </span>
            );
          })()}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onLoad}
          disabled={
            busy ||
            flashing ||
            (!isFake && (!firmware.active || status !== "live"))
          }
          title={
            isFake
              ? "Load mock — runs the flash flow without hardware"
              : !firmware.active
                ? "Unlisted firmware isn't on the site, so it can't be loaded. List it first."
                : status !== "live"
                  ? "Available once the file finishes uploading"
                  : "Open this firmware — fills in the edit form and loads the file into the flasher"
          }
          className="cursor-pointer border border-black bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black transition-colors duration-200 ease-out hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:border-dashed disabled:border-black/30 disabled:text-black/30"
        >
          Load
        </button>
        {!isFake && (
          <>
            <button
              type="button"
              onClick={onToggleActive}
              disabled={busy || toggling || flashing}
              title={
                firmware.active
                  ? `Unlist — take this off the ${channelLabel} page and off the site. The file is kept, so this is reversible.`
                  : `List — put this back on the ${channelLabel} page and make it downloadable again.`
              }
              className="cursor-pointer border border-black/40 bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black/70 transition-colors duration-200 ease-out hover:border-black hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              {toggling ? "…" : firmware.active ? "Unlist" : "List"}
            </button>
            {/* Delete is only reachable once a firmware is unlisted. Two
                deliberate steps from live, so the destructive action can't sit
                one stray click away from a firmware users are downloading —
                the pattern every surveyed tool follows. */}
            {!firmware.active && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                title="Delete permanently. The file is removed from the site and can't be recovered here."
                className="cursor-pointer border border-red bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-red transition-colors duration-200 ease-out hover:bg-red hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "…" : "Delete"}
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
};
