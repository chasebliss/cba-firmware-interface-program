import { useState } from "react";
import { NotesField } from "@/components/NotesField";
import { noteBlocks } from "@/lib/firmware-catalogue";

type Tab = "public" | "internal";

interface NotesTabsProps {
  description: string;
  internalNotes: string;
  onChange: (field: "description" | "internalNotes", value: string) => void;
}

// Release notes and internal notes as two tabs over one panel. They were
// stacked, which made the form tall enough that the channel picker and the
// save button fell below the fold on a laptop. Only one is ever being written
// at a time, so only one needs to be on screen.
//
// The inactive tab still shows a filled dot, because a tab that hides content
// can hide the fact that content exists at all — the one real cost of tabbing
// these.
export const NotesTabs = ({
  description,
  internalNotes,
  onChange,
}: NotesTabsProps) => {
  const [tab, setTab] = useState<Tab>("public");

  const tabs = [
    {
      id: "public" as const,
      label: "Release notes",
      hint: "optional",
      value: description,
      field: "description" as const,
      variant: "public" as const,
      placeholder:
        "- Fixed the thing that was broken\n- Improved the other thing\n\nAnything else worth saying, as a paragraph.",
    },
    {
      id: "internal" as const,
      label: "Internal notes",
      hint: "never shown publicly",
      value: internalNotes,
      field: "internalNotes" as const,
      variant: "internal" as const,
      placeholder:
        "Notes for the team only.\nHardware configs, things to vet, caveats.",
    },
  ];
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    // The notes are a region, not another field: mt-6 breaks the form's flat
    // gap-3.5 rhythm so the tabs read as the start of something rather than
    // as the next input down. Everything above is one-line metadata; this is
    // where the writing happens.
    <div className="mt-6">
      <div
        role="tablist"
        className="mb-4 flex gap-7 border-b border-border/10"
      >
        {tabs.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              // pb-2.5 pt-1 gives the label real vertical room to be
              // clicked; pb-2 pt-0 made an 8px-tall target.
              className={`-mb-px flex cursor-pointer items-center gap-2 border-0 border-b-2 border-b-solid bg-transparent px-0 pb-2.5 pt-1 text-meta font-bold uppercase tracking-[0.1em] transition-colors duration-200 ${
                selected
                  ? "border-b-text text-text"
                  : "border-b-transparent text-text/38"
              }`}
            >
              {t.label}
              {/* Says "there is something in the other tab" without making
                  the user open it to find out. */}
              {noteBlocks(t.value).length > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${
                    selected ? "bg-text/45" : "bg-text/25"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
      <NotesField
        // Remount per tab so the Syntax popover and Preview toggle reset
        // rather than carrying one tab's open state into the other.
        key={active.id}
        label={active.label}
        hint={active.hint}
        variant={active.variant}
        value={active.value}
        onChange={(v) => onChange(active.field, v)}
        placeholder={active.placeholder}
      />
    </div>
  );
};
