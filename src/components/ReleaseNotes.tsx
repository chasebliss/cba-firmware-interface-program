import type { FirmwareEntry } from "@/lib/firmware-catalogue";

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
  return d.length > 0 && d !== fw.name.trim();
};

// The admin writes one change per line, so newlines are the only structure.
// Split rather than using whitespace-pre-line: blank lines from pasted text
// would otherwise render as gaps.
const notesFor = (fw: FirmwareEntry): string[] =>
  hasNotes(fw)
    ? fw.description
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const ReleaseNotes = ({ firmware, catalogue }: ReleaseNotesProps) => {
  const pedal = firmware.pedal.trim();

  const versions = (
    pedal
      ? catalogue.filter((fw) => fw.pedal.trim() === pedal)
      : [firmware]
  )
    // Newest first. uploadedAt is the original release date and survives
    // edits, so it stays stable as a sort key.
    .sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? ""))
    // A version with nothing written about it adds a heading and no content,
    // so it is dropped rather than shown as an empty row.
    .filter((fw) => notesFor(fw).length > 0);

  if (versions.length === 0) return null;

  return (
    <div className="mt-7 border-t-2 border-border/15 pt-6">
      <p
        key={`h-${firmware.id}`}
        className="animate-cba-pop-in mb-4 text-meta font-bold uppercase tracking-widest text-text/38"
      >
        Release notes
      </p>
      <ol key={firmware.id} className="flex list-none flex-col gap-5 p-0">
        {versions.map((fw, i) => (
          <li
            key={`${fw.source.name}-${fw.id}`}
            className="animate-cba-pop-in border-l-2 pl-3.5"
            // Staggered so the list assembles top-down rather than appearing
            // all at once. Same 40ms step the dropdown rows use.
            style={{
              borderColor: fw.bgColor,
              animationDelay: `${i * 40}ms`,
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3
                className={`text-caption font-bold ${
                  fw.id === firmware.id ? "" : "text-text/55"
                }`}
              >
                {fw.name}
              </h3>
              {fw.uploadedAt && (
                <time
                  dateTime={fw.uploadedAt}
                  className="text-micro font-semibold uppercase tracking-[0.06em] text-text/38"
                >
                  {formatDate(fw.uploadedAt)}
                </time>
              )}
            </div>
            <ul className="mt-1.5 flex flex-col gap-1">
              {notesFor(fw).map((line, i) => (
                <li
                  key={i}
                  className="text-caption leading-[1.5] text-text/60"
                >
                  {line}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
};
