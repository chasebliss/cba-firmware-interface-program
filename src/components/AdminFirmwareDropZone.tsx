import { useState } from "react";
import { GOLD } from "@/lib/admin-firmware";

interface AdminFirmwareDropZoneProps {
  file: File | null;
  parseError: string | null;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  onRemove: () => void;
}

export const AdminFirmwareDropZone = ({
  file,
  parseError,
  disabled = false,
  onPick,
  onRemove,
}: AdminFirmwareDropZoneProps) => {
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <label
        className="flex  cursor-pointer items-center justify-center gap-2.5 px-6 py-5 text-[15px] font-bold transition-[border-color,background] duration-200"
        style={{
          border: `2px dashed ${dragging ? GOLD : file ? "#000" : "rgba(0,0,0,0.2)"}`,
          background: dragging
            ? "rgba(186,142,81,0.12)"
            : file
              ? "rgba(186,142,81,0.06)"
              : "var(--color-cream)",
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (disabled) return;
          e.dataTransfer.dropEffect = "copy";
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
          if (disabled) return;
          const picked = e.dataTransfer.files?.[0] ?? null;
          if (!picked) return;
          onPick(picked);
        }}
      >
        <svg
          width="18"
          height="18"
          fill="none"
          stroke={file ? GOLD : "rgba(0,0,0,0.3)"}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <span
          className="max-w-[280px] truncate"
          style={{ color: file ? "#000" : "rgba(0,0,0,0.4)" }}
        >
          {file ? file.name : "Choose .bin or .hex file"}
        </span>
        <input
          type="file"
          accept=".bin,.hex"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const picked = e.target.files?.[0] ?? null;
            onPick(picked);
          }}
        />
      </label>
      {parseError && (
        <p className="mt-2 text-sm font-semibold text-red">
          Could not parse file: {parseError}
        </p>
      )}
      {file && (
        <div className="mt-2.5 flex items-center gap-2.5">
          <div
            className="flex-1 border px-3 py-2 font-mono text-[12px]"
            style={{
              borderColor: "rgba(0,0,0,0.1)",
              background: "rgba(0,0,0,0.02)",
              color: "rgba(0,0,0,0.5)",
            }}
          >
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[12px] font-bold text-black/35 underline underline-offset-[3px]"
          >
            Remove
          </button>
        </div>
      )}
    </>
  );
};
