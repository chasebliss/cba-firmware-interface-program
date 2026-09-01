// The save-form draft: one module owning the metadata fields an admin edits
// before publishing a firmware, plus edit mode, dirty-checking and validity.
//
// This used to be nine useState hooks spread through LocalFlasher, with a
// hand-maintained snapshot object and an isDirty() that listed every field
// twice — adding the pedal field touched eight sites and silently missed two
// dirty branches. Here the field list is written once (DraftFields), and
// everything else iterates it, so a new field is one line in one place.
//
// The baseline for dirty-checking is DERIVED, not stored: while editing, the
// entry being edited already holds every field the old snapshot copied out of
// it. The pure helpers below are the testable core; useSaveDraft is a thin
// React wrapper.

import { useState } from "react";
import {
  GOLD,
  type SavedFirmware,
  type SaveStatus,
  type SaveTarget,
} from "@/lib/admin-firmware";

// What the save-form target defaults to for a fresh upload. Deliberately not
// production — an accidental save should land somewhere harmless.
export const DEFAULT_SAVE_TARGET: SaveTarget = "beta";

// The one place the field list lives. upload-firmware.js accepts exactly
// these (plus filename/content/overwrite, which belong to the file, not the
// draft).
export interface DraftFields {
  name: string;
  pedal: string;
  description: string;
  internalNotes: string;
  bgColor: string;
  target: SaveTarget;
}

export const emptyFields = (): DraftFields => ({
  name: "",
  pedal: "",
  description: "",
  internalNotes: "",
  bgColor: GOLD,
  target: DEFAULT_SAVE_TARGET,
});

// The draft-shaped view of a catalogue entry: what the form is prefilled with
// on Load, and the baseline edits are compared against.
export const fieldsFrom = (entry: SavedFirmware): DraftFields => ({
  name: entry.name,
  pedal: entry.pedal,
  description: entry.description,
  internalNotes: entry.internalNotes,
  bgColor: entry.bgColor,
  target: entry.target,
});

const norm = (v: string) => v.trim();

// True if any field meaningfully differs from the baseline. Key-wise over
// DraftFields, so a field added to the type is dirty-checked automatically.
// Whitespace-only differences don't count: the save path trims before
// sending, so they could never produce a different saved result.
export const isDraftDirty = (
  fields: DraftFields,
  baseline: DraftFields,
): boolean =>
  (Object.keys(fields) as Array<keyof DraftFields>).some(
    (key) => norm(fields[key]) !== norm(baseline[key]),
  );

// The fields the API will reject as missing. Everything else is optional.
export const draftComplete = (fields: DraftFields): boolean =>
  fields.name.trim().length > 0 && fields.pedal.trim().length > 0;

export type SaveDraft = ReturnType<typeof useSaveDraft>;

export const useSaveDraft = () => {
  const [fields, setFields] = useState<DraftFields>(emptyFields);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  // When non-null, the form is in "edit mode" — Load was clicked on this
  // catalogue row. Save becomes Update/Copy; banner + confirmations kick in.
  const [editingEntry, setEditingEntry] = useState<SavedFirmware | null>(null);

  const set = <K extends keyof DraftFields>(key: K, value: DraftFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setFields(emptyFields());
    setStatus("idle");
    setMessage(null);
    setEditingEntry(null);
  };

  const beginEdit = (entry: SavedFirmware) => {
    setFields(fieldsFrom(entry));
    setStatus("idle");
    setMessage(null);
    setEditingEntry(entry);
  };

  const beginSave = () => {
    setStatus("saving");
    setMessage(null);
  };

  const failSave = (msg: string) => {
    setStatus("error");
    setMessage(msg);
  };

  return {
    fields,
    status,
    message,
    editingEntry,
    isEditing: editingEntry !== null,
    // While editing, picking a channel other than the entry's own turns Save
    // into a copy rather than a move.
    targetChanged:
      editingEntry !== null && editingEntry.target !== fields.target,
    isDirty: () =>
      isDraftDirty(
        fields,
        editingEntry ? fieldsFrom(editingEntry) : emptyFields(),
      ),
    complete: draftComplete(fields),
    set,
    reset,
    beginEdit,
    beginSave,
    failSave,
  };
};
