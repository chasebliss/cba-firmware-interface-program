import { CbaButton } from "@/components/CbaButton";
import { NotesTabs } from "@/components/NotesTabs";
import { SectionLabel } from "@/components/SectionLabel";
import { CHANNELS } from "@/lib/admin-firmware";
import type { SaveDraft } from "@/lib/save-draft";

// Sentinel option value. Selecting it switches the control to free text
// rather than storing anything.
const NEW_PEDAL = "__new__";

interface AdminSaveFormProps {
  // The whole form edits this one draft; everything below is context the
  // draft can't know about (the loaded file, the catalogue, flash state).
  draft: SaveDraft;
  file: File | null;
  knownPedals: string[];
  duplicateInTarget: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancelEdit: () => void;
}

export const AdminSaveForm = ({
  draft,
  file,
  knownPedals,
  duplicateInTarget,
  canSave,
  onSave,
  onCancelEdit,
}: AdminSaveFormProps) => {
  const { fields, editingEntry, isEditing, targetChanged } = draft;
  const hasFile = file !== null;
  // A pedal not yet in any channel puts the field into free-text mode. The
  // select alone can't express "first firmware for a new product", and a
  // second control is clearer than an editable combobox.
  const addingPedal = fields.pedal !== "" && !knownPedals.includes(fields.pedal);
  const saveButtonLabel = isEditing
    ? targetChanged
      ? `Copy to ${fields.target}`
      : "Update firmware"
    : "Save firmware";

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: hasFile ? 1 : 0.4 }}
    >
      <SectionLabel>
        3.{" "}
        {isEditing
          ? targetChanged
            ? `Copy to ${fields.target}`
            : "Update firmware"
          : "Publish firmware"}
        {!isEditing && (
          <span className="font-medium normal-case tracking-normal text-text/30">
            {" "}
            (optional — flashing above doesn't require this)
          </span>
        )}
      </SectionLabel>
      {isEditing && editingEntry && (
        <div
          className="mb-3.5 flex min-h-[88px]  items-start justify-between gap-3 border-2 px-3 py-2"
          style={{
            borderColor: editingEntry.bgColor,
            background: `${editingEntry.bgColor}14`,
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold leading-[1.4]">
              {targetChanged
                ? `Copying "${editingEntry.name}"`
                : `Editing "${editingEntry.name}"`}
              <span className="font-normal text-text/60">
                {" "}
                {targetChanged
                  ? `(${editingEntry.target} → ${fields.target})`
                  : `in ${editingEntry.target}`}
              </span>
            </p>
            <p className="mt-1 text-caption leading-[1.5] text-text/55">
              {targetChanged
                ? "The original stays put — a new entry is created in the destination."
                : "Saving overwrites the existing file and metadata."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-meta font-bold uppercase tracking-[0.08em] text-text/55 underline underline-offset-[3px]"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="flex  flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-meta font-bold uppercase tracking-[0.1em] text-text/38">
            Name
          </label>
          <input
            type="text"
            value={fields.name}
            onChange={(e) => draft.set("name", e.target.value)}
            placeholder="e.g. MOOD MKII v1.2"
            className="w-full border-2 border-border bg-surface px-3 py-2.5 text-body font-bold outline-none"
          />
          {isEditing && (
            <p className="mt-1 text-caption text-text/45">
              Filename stays as{" "}
              <span className="font-mono">{editingEntry?.filename}</span>. To
              rename, delete the entry and re-upload.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-meta font-bold uppercase tracking-[0.1em] text-text/38">
            Pedal
          </label>
          {addingPedal || knownPedals.length === 0 ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={fields.pedal}
                onChange={(e) => draft.set("pedal", e.target.value)}
                placeholder="e.g. MOOD MKII"
                className="w-full border-2 border-border bg-surface px-3 py-2.5 text-body font-bold outline-none"
              />
              {knownPedals.length > 0 && (
                <button
                  type="button"
                  onClick={() => draft.set("pedal", "")}
                  className="shrink-0 cursor-pointer border-2 border-border bg-surface px-3 text-meta font-bold uppercase tracking-[0.08em] text-text/55"
                >
                  Pick
                </button>
              )}
            </div>
          ) : (
            <select
              value={fields.pedal}
              onChange={(e) =>
                // The sentinel never reaches state. Picking it clears the
                // field, and an empty value with no match flips the branch
                // above into the free-text input.
                draft.set(
                  "pedal",
                  e.target.value === NEW_PEDAL ? " " : e.target.value,
                )
              }
              className="w-full cursor-pointer border-2 border-border bg-surface px-3 py-2.5 text-body font-bold outline-none"
            >
              <option value="">Select pedal...</option>
              {knownPedals.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value={NEW_PEDAL}>+ New pedal...</option>
            </select>
          )}
          <p className="mt-1 text-caption text-text/45">
            Groups every version of this pedal on its release-notes page.
          </p>
        </div>
        {/* Public notes render in the picker's side panel; internal notes
            are stripped by publicEntries() before the served firmwares.json
            is written, so they never leave the admin manifest. */}
        <NotesTabs
          description={fields.description}
          internalNotes={fields.internalNotes}
          onChange={draft.set}
        />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-meta font-bold uppercase tracking-[0.1em] text-text/38">
              Accent color
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={fields.bgColor}
                onChange={(e) => draft.set("bgColor", e.target.value)}
                className="h-9 w-10 cursor-pointer border-2 border-border bg-surface p-0.5"
              />
              <span className="font-mono text-caption font-bold text-text/50">
                {fields.bgColor}
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-meta font-bold uppercase tracking-[0.1em] text-text/38">
              {isEditing ? "Save to channel" : "Channel"}
            </label>
            <div className="flex gap-4">
              {CHANNELS.map((channel) => {
                // While editing, picking a channel other than the entry's own
                // turns Save into a copy — it creates a second entry rather
                // than moving the first. That used to be invisible until after
                // the click, so each option now says which it is.
                const isCopyDestination =
                  isEditing && editingEntry?.target !== channel.id;
                return (
                  <label
                    key={channel.id}
                    title={
                      isCopyDestination
                        ? `Copy to ${channel.label} — creates a second entry; the original stays in ${editingEntry?.target}.`
                        : undefined
                    }
                    className="flex cursor-pointer items-center gap-1.5 text-body-sm font-bold"
                  >
                    <input
                      type="radio"
                      name="saveTarget"
                      value={channel.id}
                      checked={fields.target === channel.id}
                      onChange={() => draft.set("target", channel.id)}
                      style={{ accentColor: "var(--text)" }}
                    />
                    {channel.label}
                    {isCopyDestination && (
                      <span className="font-normal text-meta uppercase tracking-[0.06em] text-text/35">
                        copy
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="relative mt-10 flex items-center gap-4">
          <CbaButton disabled={!canSave} onClick={onSave} fullWidth>
            {draft.status === "saving" ? "Saving…" : saveButtonLabel}
          </CbaButton>
          {duplicateInTarget && (
            <div
              role="alert"
              className="animate-tab-fade absolute left-1/2 top-full z-20 mt-2 w-[280px] -translate-x-1/2 border-2 border-border bg-surface px-3 py-2 shadow-cba"
            >
              <p className="text-caption font-bold leading-[1.4]">
                Already in {fields.target} as{" "}
                <span className="font-mono">{file?.name}</span>.
              </p>
              <p className="mt-0.5 text-caption text-text/55">
                Delete the existing entry or switch target to save.
              </p>
            </div>
          )}
          {!duplicateInTarget && draft.message && (
            <p
              className={`max-w-[200px] text-body-sm font-bold leading-[1.4] ${draft.status === "error" ? "text-bad" : "text-ok"}`}
            >
              {draft.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
