import { CbaButton } from "@/components/CbaButton";
import { SectionLabel } from "@/components/SectionLabel";
import {
  CHANNELS,
  type AdminFirmware,
  type SaveStatus,
  type SaveTarget,
} from "@/lib/admin-firmware";

interface AdminSaveFormProps {
  hasFile: boolean;
  file: File | null;
  saveName: string;
  saveDescription: string;
  saveBgColor: string;
  saveTarget: SaveTarget;
  onSaveNameChange: (v: string) => void;
  onSaveDescriptionChange: (v: string) => void;
  onSaveBgColorChange: (v: string) => void;
  onSaveTargetChange: (v: SaveTarget) => void;
  editingEntry: AdminFirmware | null;
  targetChanged: boolean;
  duplicateInTarget: boolean;
  canSave: boolean;
  saveStatus: SaveStatus;
  saveMessage: string | null;
  saveButtonLabel: string;
  onSave: () => void;
  onCancelEdit: () => void;
}

export const AdminSaveForm = ({
  hasFile,
  file,
  saveName,
  saveDescription,
  saveBgColor,
  saveTarget,
  onSaveNameChange,
  onSaveDescriptionChange,
  onSaveBgColorChange,
  onSaveTargetChange,
  editingEntry,
  targetChanged,
  duplicateInTarget,
  canSave,
  saveStatus,
  saveMessage,
  saveButtonLabel,
  onSave,
  onCancelEdit,
}: AdminSaveFormProps) => {
  const isEditing = editingEntry !== null;

  return (
    <div
      className="transition-opacity duration-300"
      style={{ opacity: hasFile ? 1 : 0.4 }}
    >
      <SectionLabel>
        3.{" "}
        {isEditing
          ? targetChanged
            ? `Copy to ${saveTarget}`
            : "Update firmware"
          : "Save firmware"}
        {!isEditing && (
          <span className="font-medium normal-case tracking-normal text-black/30">
            {" "}
            (optional)
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
            <p className="text-[11px] font-bold leading-[1.4]">
              {targetChanged
                ? `Copying "${editingEntry.name}"`
                : `Editing "${editingEntry.name}"`}
              <span className="font-normal text-black/60">
                {" "}
                {targetChanged
                  ? `(${editingEntry.target} → ${saveTarget})`
                  : `in ${editingEntry.target}`}
              </span>
            </p>
            <p className="mt-1 text-[11px] leading-[1.5] text-black/55">
              {targetChanged
                ? "The original stays put — a new entry is created in the destination."
                : "Saving overwrites the existing file and metadata."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[10px] font-bold uppercase tracking-[0.08em] text-black/55 underline underline-offset-[3px]"
          >
            Cancel
          </button>
        </div>
      )}
      <div className="flex  flex-col gap-3.5">
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/38">
            Name
          </label>
          <input
            type="text"
            value={saveName}
            onChange={(e) => onSaveNameChange(e.target.value)}
            placeholder="e.g. MOOD MKII v1.2"
            className="w-full border-2 border-black bg-cream px-3 py-2.5 text-[15px] font-bold outline-none"
          />
          {isEditing && (
            <p className="mt-1 text-[11px] text-black/45">
              Filename stays as{" "}
              <span className="font-mono">{editingEntry?.filename}</span>. To
              rename, delete the entry and re-upload.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/38">
            Description{" "}
            <span className="font-normal normal-case tracking-normal">
              (optional)
            </span>
          </label>
          <input
            type="text"
            value={saveDescription}
            onChange={(e) => onSaveDescriptionChange(e.target.value)}
            placeholder="Brief changelog"
            className="w-full border-2 border-black bg-cream px-3 py-2.5 text-[15px] font-bold outline-none"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/38">
              Accent color
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={saveBgColor}
                onChange={(e) => onSaveBgColorChange(e.target.value)}
                className="h-9 w-10 cursor-pointer border-2 border-black bg-cream p-0.5"
              />
              <span className="font-mono text-[12px] font-bold text-black/50">
                {saveBgColor}
              </span>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-black/38">
              Target
            </label>
            <div className="flex gap-4">
              {CHANNELS.map((channel) => (
                <label
                  key={channel.id}
                  className="flex cursor-pointer items-center gap-1.5 text-[13px] font-bold"
                >
                  <input
                    type="radio"
                    name="saveTarget"
                    value={channel.id}
                    checked={saveTarget === channel.id}
                    onChange={() => onSaveTargetChange(channel.id)}
                    style={{ accentColor: "#000" }}
                  />
                  {channel.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="relative mt-10 flex items-center gap-4">
          <CbaButton disabled={!canSave} onClick={onSave} fullWidth>
            {saveStatus === "saving" ? "Saving…" : saveButtonLabel}
          </CbaButton>
          {duplicateInTarget && (
            <div
              role="alert"
              className="animate-tab-fade absolute left-1/2 top-full z-20 mt-2 w-[280px] -translate-x-1/2 border-2 border-black bg-cream px-3 py-2 shadow-cba"
            >
              <p className="text-[12px] font-bold leading-[1.4]">
                Already in {saveTarget} as{" "}
                <span className="font-mono">{file?.name}</span>.
              </p>
              <p className="mt-0.5 text-[11px] text-black/55">
                Delete the existing entry or switch target to save.
              </p>
            </div>
          )}
          {!duplicateInTarget && saveMessage && (
            <p
              className={`max-w-[200px] text-[13px] font-bold leading-[1.4] ${saveStatus === "error" ? "text-red" : "text-green"}`}
            >
              {saveMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
