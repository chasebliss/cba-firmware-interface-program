import { AdminFirmwareListSkeleton } from "@/components/AdminFirmwareListSkeleton";
import { AdminFirmwareRow } from "@/components/AdminFirmwareRow";
import { SectionLabel } from "@/components/SectionLabel";
import type {
  AdminFirmware,
  DeployStatus,
  SaveTarget,
} from "@/lib/admin-firmware";

export interface FirmwareSection {
  id: string;
  label: string;
  color: string;
  rows: AdminFirmware[];
  // Page that serves this channel. Undefined for the mock section, which has
  // no public page — that header stays plain text.
  route?: string;
}

interface AdminFirmwareListProps {
  loading: boolean;
  error: string | null;
  showMockRow: boolean;
  catalogueEmpty: boolean;
  cachedCounts: Partial<Record<SaveTarget, number>>;
  sections: FirmwareSection[];
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
  sections,
  deployStatus,
  deleting,
  toggling,
  flashing,
  onLoad,
  onToggleActive,
  onDelete,
}: AdminFirmwareListProps) => {
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
              <section key={section.id}>
                <div className="mb-2 flex items-baseline gap-2">
                  {section.route ? (
                    <a
                      href={section.route}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${section.route} in a new tab`}
                      className="group flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest no-underline hover:underline"
                      style={{ color: section.color }}
                    >
                      {section.label}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="h-2 w-2 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 17L17 7M17 7H8M17 7v9"
                        />
                      </svg>
                    </a>
                  ) : (
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: section.color }}
                    >
                      {section.label}
                    </span>
                  )}
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

    </div>
  );
};
