import {
  FAKE_BG_COLOR,
  FAKE_FILENAME,
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

  const dotColor = isFake
    ? FAKE_BG_COLOR
    : !firmware.active
      ? "var(--color-red)"
      : status === "live"
        ? "var(--color-green)"
        : status === "pending"
          ? "var(--color-yellow)"
          : "rgba(0,0,0,0.2)";
  const dotTitle = isFake
    ? "Mock device — no real hardware"
    : !firmware.active
      ? "Disabled — hidden from users"
      : status === "live"
        ? "Live for users"
        : status === "pending"
          ? "Saved — site is still updating"
          : "Checking…";

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
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span
            aria-label={dotTitle}
            title={dotTitle}
            className="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
            style={{ background: dotColor }}
          />
          <span
            title={firmware.name}
            className="truncate text-[14px] font-bold"
          >
            {firmware.name}
          </span>
          {!firmware.active && (
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
          disabled={busy || flashing || (!isFake && status !== "live")}
          title={
            isFake
              ? "Load mock — runs the flash flow without hardware"
              : status !== "live"
                ? "Available once the site finishes updating"
                : "Load into flasher"
          }
          className="cursor-pointer border border-black bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black transition-colors duration-200 ease-out hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
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
                  ? "Disable — hide from users, keep in admin"
                  : "Enable — show to users again"
              }
              className="cursor-pointer border border-black/40 bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-black/70 transition-colors duration-200 ease-out hover:border-black hover:bg-black hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
            >
              {toggling ? "…" : firmware.active ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="cursor-pointer border border-red bg-transparent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-red transition-colors duration-200 ease-out hover:bg-red hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "…" : "Delete"}
            </button>
          </>
        )}
      </div>
    </li>
  );
};
