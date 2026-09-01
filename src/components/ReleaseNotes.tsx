import { ReleaseNotesVersion } from "@/components/ReleaseNotesVersion";
import {
  noteItems,
  versionsOf,
  type FirmwareEntry,
} from "@/lib/firmware-catalogue";

interface ReleaseNotesProps {
  firmware: FirmwareEntry;
  // The whole channel catalogue, so past versions of the same pedal can be
  // listed without refetching. Already scoped to one channel by the caller.
  catalogue: FirmwareEntry[];
}

// Entries written before release notes existed stored the firmware name as
// their description, so a description equal to the name carries no
// information and is treated as absent. New entries store "" when the admin
// leaves the field blank, so that check only matters for the old ones.
const hasNotes = (fw: FirmwareEntry): boolean => {
  const d = fw.description?.trim() ?? "";
  return d.length > 0 && d !== fw.name.trim() && noteItems(d).length > 0;
};

export const ReleaseNotes = ({ firmware, catalogue }: ReleaseNotesProps) => {
  const pedal = firmware.pedal.trim();

  // A version with nothing written about it adds a heading and no content,
  // so it is dropped rather than shown as an empty row.
  const versions = (pedal ? versionsOf(catalogue, pedal) : [firmware]).filter(
    hasNotes,
  );

  if (versions.length === 0) return null;

  return (
    <div className="mt-7 border-t-2 border-border/15 pt-6">
      <p className="animate-cba-pop-in mb-4 text-meta font-bold uppercase tracking-widest text-text/38">
        Release notes
      </p>
      {/* The selected version arrives open; older ones are collapsed, so the
          panel stays short no matter how long a pedal's history gets. Keys
          are stable across selection changes, so the panel is not remounted
          and does not replay its entrance animation. */}
      <ol className="flex list-none flex-col gap-4 p-0">
        {versions.map((fw, i) => (
          <ReleaseNotesVersion
            key={`${fw.source.name}-${fw.id}`}
            firmware={fw}
            selected={fw.id === firmware.id}
            index={i}
          />
        ))}
      </ol>
    </div>
  );
};
