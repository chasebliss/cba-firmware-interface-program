import { AdminFirmwareListSkeleton } from "@/components/AdminFirmwareListSkeleton";
import { AdminFirmwareRow } from "@/components/AdminFirmwareRow";
import { SectionLabel } from "@/components/SectionLabel";
import {
  GOLD,
  type AdminFirmware,
  type DeployStatus,
} from "@/lib/admin-firmware";

interface AdminFirmwareListProps {
  loading: boolean;
  error: string | null;
  showMockRow: boolean;
  catalogueEmpty: boolean;
  cachedCounts: { production: number; beta: number };
  productionRows: AdminFirmware[];
  betaRows: AdminFirmware[];
  deployStatus: Record<string, DeployStatus>;
  deleting: string | null;
  toggling: string | null;
  flashing: boolean;
  onLoad: (entry: AdminFirmware) => void;
  onToggleActive: (entry: AdminFirmware) => void;
  onDelete: (entry: AdminFirmware) => void;
}

export const AdminFirmwareList = ({
  loading,
  error,
  showMockRow,
  catalogueEmpty,
  cachedCounts,
  productionRows,
  betaRows,
  deployStatus,
  deleting,
  toggling,
  flashing,
  onLoad,
  onToggleActive,
  onDelete,
}: AdminFirmwareListProps) => {
  const sections = [
    {
      label: "Production" as const,
      color: "var(--color-green)",
      rows: productionRows,
    },
    {
      label: "Beta" as const,
      color: GOLD,
      rows: betaRows,
    },
  ];

  return (
    <div className="pb-20 pt-0 md:pl-9 md:pt-9">
      <div className="mb-5">
        <SectionLabel className="mb-0">Saved firmwares</SectionLabel>
      </div>

      <div data-no-trail className="flex flex-col gap-6">
        {loading && <AdminFirmwareListSkeleton cachedCounts={cachedCounts} />}
        {error && (
          <p className="px-6 py-6 text-center text-sm font-semibold text-red">
            Could not load: {error}
          </p>
        )}
        {!loading && !error && catalogueEmpty && !showMockRow && (
          <p className="px-6 py-6 text-center text-[14px] text-black/35">
            Nothing uploaded yet.
          </p>
        )}
        {!loading && !error && catalogueEmpty && showMockRow && (
          <p className="px-3.5 pt-1 text-[11px] text-black/35">
            No real firmwares uploaded yet — the mock below runs the flow
            without hardware.
          </p>
        )}
        {!loading &&
          !error &&
          sections
            .filter((s) => s.rows.length > 0)
            .map((section) => (
              <section key={section.label}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: section.color }}
                  >
                    {section.label}
                  </span>
                  <span className="text-[9px] font-bold tracking-widest text-black/35">
                    {section.rows.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-px">
                  {section.rows.map((fw) => {
                    const key = `${fw.target}:${fw.filename}`;
                    return (
                      <AdminFirmwareRow
                        key={key}
                        firmware={fw}
                        status={deployStatus[key]}
                        busy={deleting === key}
                        toggling={toggling === key}
                        flashing={flashing}
                        onLoad={() => onLoad(fw)}
                        onToggleActive={() => onToggleActive(fw)}
                        onDelete={() => onDelete(fw)}
                      />
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
          Yellow — saved, site is still updating (usually under a 30 seconds).
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
  );
};
