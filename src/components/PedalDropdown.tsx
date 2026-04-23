import { useEffect, useRef, useState } from "react";
import type { FirmwareEntry } from "@/lib/firmware-catalogue";

interface PedalDropdownProps {
  firmwares: FirmwareEntry[];
  selected: FirmwareEntry | null;
  onSelect: (firmware: FirmwareEntry) => void;
  loading?: boolean;
  disabled?: boolean;
}

export const PedalDropdown = ({
  firmwares,
  selected,
  onSelect,
  loading = false,
  disabled = false,
}: PedalDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const triggerShadow = open || selected ? "shadow-cba" : "shadow-none";
  const triggerLabel = loading
    ? "Loading pedals…"
    : selected
      ? selected.name
      : "Select Pedal...";
  const isDisabled = disabled || loading || firmwares.length === 0;

  return (
    <div ref={containerRef} className="relative w-96 max-w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isDisabled}
        className={`flex w-full cursor-pointer items-center justify-between border-2 border-black bg-cream px-4 py-3 text-left font-bold transition-shadow duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${triggerShadow}`}
      >
        <span>{triggerLabel}</span>
        <svg
          viewBox="0 0 20 20"
          width="24"
          height="24"
          aria-hidden="true"
          className={`transition-transform duration-150 ease-out ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-4.293-1.707a1 1 0 00-1.414 0L10 10.586 7.707 8.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 000-1.414z"
            fill="#ba8e51"
          />
        </svg>
      </button>
      {open && firmwares.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 z-10 max-h-80 overflow-y-auto border-2 border-t-0 border-black bg-cream"
        >
          {firmwares.map((fw, i) => (
            <li
              key={fw.id}
              role="option"
              aria-selected={selected?.id === fw.id}
              onMouseEnter={() => setHovered(fw.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => {
                onSelect(fw);
                setOpen(false);
              }}
              className={`animate-cba-pop-in cursor-pointer px-4 py-3 font-bold transition-colors duration-150 ${
                i < firmwares.length - 1 ? "border-b border-black" : ""
              }`}
              style={{
                background: hovered === fw.id ? fw.bgColor : undefined,
                animationDelay: `${i * 20}ms`,
              }}
            >
              {fw.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
