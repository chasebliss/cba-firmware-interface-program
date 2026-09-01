import { useState } from "react";
import { NoteList } from "@/components/NoteList";
import { noteItems, type FirmwareEntry } from "@/lib/firmware-catalogue";

interface ReleaseNotesVersionProps {
  firmware: FirmwareEntry;
  // The version the user has selected in the picker. Its notes are open on
  // arrival; every older version starts collapsed.
  selected: boolean;
  index: number;
}

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

export const ReleaseNotesVersion = ({
  firmware,
  selected,
  index,
}: ReleaseNotesVersionProps) => {
  // Open state follows the selection by default, so picking a version in the
  // dropdown opens its notes. A click overrides that until the selection
  // changes again, at which point the override is dropped. Derived rather
  // than stored, so no remount is needed to resync and the panel's entrance
  // animation does not replay.
  const [override, setOverride] = useState<boolean | null>(null);
  const [lastSelected, setLastSelected] = useState(selected);
  if (lastSelected !== selected) {
    setLastSelected(selected);
    setOverride(null);
  }
  const open = override ?? selected;
  const items = noteItems(firmware.description);

  return (
    <li
      // list-none: the version heading is a heading, not a bullet. Only the
      // note lines inside carry markers.
      className="animate-cba-pop-in list-none border-l-2 pl-3.5"
      // Staggered so the list assembles top-down rather than appearing all at
      // once. Same 40ms step the dropdown rows use.
      style={{
        borderColor: firmware.bgColor,
        animationDelay: `${index * 40}ms`,
      }}
    >
      <button
        type="button"
        onClick={() => setOverride(!open)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 border-none bg-transparent p-0 text-left"
      >
        <h3
          className={`text-caption font-bold ${selected ? "" : "text-text/55"}`}
        >
          {firmware.name}
        </h3>
        {firmware.uploadedAt && (
          <time
            dateTime={firmware.uploadedAt}
            className="text-micro font-semibold uppercase tracking-[0.06em] text-text/38"
          >
            {formatDate(firmware.uploadedAt)}
          </time>
        )}
        {!open && (
          <span className="text-micro font-semibold text-text/30">
            {items.length} {items.length === 1 ? "change" : "changes"}
          </span>
        )}
      </button>
      {open && (
        <div className="animate-cba-pop-in mt-1.5">
          <NoteList items={items} />
        </div>
      )}
    </li>
  );
};
