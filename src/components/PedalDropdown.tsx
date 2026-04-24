import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FirmwareEntry } from "@/lib/firmware-catalogue";
import { formatRelativeTime } from "@/lib/format";

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
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const t = event.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        menuRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuRect({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const triggerShadow = open || selected ? "shadow-cba" : "shadow-none";
  const triggerLabel = loading
    ? "Loading pedals…"
    : selected
      ? selected.name
      : "Select Pedal...";
  const isDisabled = disabled || loading || firmwares.length === 0;

  return (
    <div className="relative w-96 max-w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isDisabled}
        className={`flex w-full cursor-pointer items-center justify-between border-2 border-black bg-cream px-4 py-3 text-left text-[15px] font-bold transition-shadow duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${triggerShadow}`}
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
      {open &&
        firmwares.length > 0 &&
        menuRect &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              backgroundColor: "#fefbf6",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              zIndex: 1000,
            }}
            className="max-h-80 overflow-y-auto border-2 border-t-0 border-black"
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
                className={`animate-cba-pop-in flex cursor-pointer flex-col gap-0.5 px-4 py-3 transition-colors duration-150 ${
                  i < firmwares.length - 1 ? "border-b border-black" : ""
                }`}
                style={{
                  backgroundColor: hovered === fw.id ? fw.bgColor : "#fefbf6",
                  animationDelay: `${i * 20}ms`,
                }}
              >
                <span className="text-[15px] font-bold">{fw.name}</span>
                {(fw.filename || fw.uploadedAt) && (
                  <span className="flex items-baseline gap-2 text-[11px] font-medium text-black/55">
                    {fw.filename && (
                      <span className="truncate font-mono">{fw.filename}</span>
                    )}
                    {fw.uploadedAt && (
                      <span
                        title={new Date(fw.uploadedAt).toLocaleString()}
                        className="shrink-0 text-[10px] text-black/45"
                      >
                        · {formatRelativeTime(fw.uploadedAt)}
                      </span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};
