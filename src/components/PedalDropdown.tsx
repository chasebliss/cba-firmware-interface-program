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
  // False while the menu's rows are still doing their staggered entry.
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    theme: string | null;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  // `settled` tracks only the timer; hasEntered derives it together with
  // `open`, so closing resets it during render instead of via a synchronous
  // setState in the layout effect below.
  const [settled, setSettled] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setSettled(false);
    // Cleared on both edges. On close it drops the stale position and the
    // last-hovered row, which would otherwise paint highlighted for a frame
    // when the menu reopens.
    setMenuRect(null);
    setHovered(null);
  }
  const hasEntered = open && settled;

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

  // Enable hover cross-fades only after every row has finished its staggered
  // pop-in: 220ms animation plus 20ms of delay per row.
  useEffect(() => {
    if (!open) return;
    const settle = 220 + firmwares.length * 20;
    const id = window.setTimeout(() => setSettled(true), settle);
    return () => window.clearTimeout(id);
  }, [open, firmwares.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuRect({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
        // The menu portals to document.body, landing outside any page-level
        // styling wrapper. Record whether the trigger sits inside one so the
        // portal can re-flag itself and scoped CSS still reaches it. Captured
        // here, with the measurement, rather than read from the ref during
        // render.
        theme: el.closest("[data-theme]")?.getAttribute("data-theme") ?? null,
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

  // Keep the shadow while the menu is open OR something is selected. Without
  // the `selected` half, closing the menu after a re-selection would fade the
  // shadow out over 300ms while the step card is simultaneously re-tinting —
  // two unsynchronised animations around the same control, which reads as a
  // flicker rather than one settling motion.
  const triggerShadow = open || selected ? "shadow-cba" : "shadow-none";
  const triggerLabel = loading
    ? "Loading pedals…"
    : selected
      ? selected.name
      : "Select Pedal...";
  const isDisabled = disabled || loading || firmwares.length === 0;

  return (
    <div className="relative mx-auto w-96 max-w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={isDisabled}
        className={`flex w-full cursor-pointer items-center justify-between border-2 border-border bg-surface px-4 py-3 text-left text-body font-bold transition-shadow duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${triggerShadow}`}
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
            fill="var(--accent)"
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
            data-theme={menuRect.theme ?? undefined}
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              backgroundColor: "var(--surface)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              zIndex: 1000,
            }}
            className="max-h-80 overflow-y-auto border-2 border-t-0 border-border"
          >
            {firmwares.map((fw, i) => (
              <li
                key={fw.id}
                role="option"
                aria-selected={selected?.id === fw.id}
                onMouseEnter={() => setHovered(fw.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  // Close first, then propagate. onSelect re-renders the parent
                  // (the step card takes the firmware's accent tint), and if the
                  // menu were still mounted and still flagged as hovered, that
                  // render would cross-fade this row to its accent colour for a
                  // frame on the way out — a visible flash on every selection.
                  setHovered(null);
                  setOpen(false);
                  onSelect(fw);
                }}
                className={`animate-cba-pop-in flex cursor-pointer flex-col gap-0.5 px-4 py-3 ${
                  // Colour transitions only once the row has finished its
                  // staggered entry. Transitioning during the pop-in makes a
                  // row under the cursor cross-fade while it's still animating
                  // in, which reads as a flicker on open.
                  hasEntered ? "transition-colors duration-150" : ""
                } ${i < firmwares.length - 1 ? "border-b border-border" : ""}`}
                style={{
                  backgroundColor:
                    hovered === fw.id ? fw.bgColor : "var(--surface)",
                  animationDelay: `${i * 20}ms`,
                }}
              >
                <span className="text-body font-bold">{fw.name}</span>
                {(fw.filename || fw.uploadedAt) && (
                  <span className="flex items-baseline gap-2 text-caption font-medium text-text/55">
                    {fw.filename && (
                      <span className="truncate font-mono">{fw.filename}</span>
                    )}
                    {fw.uploadedAt && (
                      <span
                        title={new Date(fw.uploadedAt).toLocaleString()}
                        className="shrink-0 text-meta text-text/45"
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
