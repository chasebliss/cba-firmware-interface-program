import { useEffect, useState, type ReactNode } from "react";

const BODY_TRANSITION_MS = 300;

// Selecting a firmware animates several things at once: this card's background
// tint, the step badge's colours, and the dropdown trigger's shadow. They ran
// at 500/300/250ms, and three unsynchronised fades around one control read as
// a flicker rather than a single settling motion. All three are 300ms now —
// keep them aligned if you change one.

interface StepBadgeProps {
  n: number;
  done: boolean;
}

export const StepBadge = ({ n, done }: StepBadgeProps) => {
  return (
    <span
      className={`cba-step-badge flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-[13px] font-bold transition-colors duration-300 ${
        done ? "bg-black text-cream" : "bg-cream text-black"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
};

interface StepCardProps {
  n: number;
  label: string;
  done: boolean;
  locked?: boolean;
  open?: boolean;
  headerRight?: ReactNode;
  children?: ReactNode;
  style?: React.CSSProperties;
}

export const StepCard = ({
  n,
  label,
  done,
  locked = false,
  open = true,
  headerRight,
  children,
  style,
}: StepCardProps) => {
  const hasBody =
    children !== undefined && children !== false && children !== null;
  const isOpen = hasBody && open;

  // Clip during the open/close transition so the grid-rows animation looks
  // right, then switch to visible so absolute-positioned descendants (like the
  // PedalDropdown menu) can escape the card bounds.
  const [overflowVisible, setOverflowVisible] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      setOverflowVisible(false);
      return;
    }
    const id = window.setTimeout(
      () => setOverflowVisible(true),
      BODY_TRANSITION_MS,
    );
    return () => window.clearTimeout(id);
  }, [isOpen]);

  return (
    <div
      className="relative -mb-[2px] border-2 border-black transition-[background,opacity] duration-300"
      style={{
        opacity: locked ? 0.28 : 1,
        zIndex: isOpen ? 20 : 1,
        ...style,
      }}
    >
      <div
        className={`flex items-center justify-between px-5 py-[15px] transition-[border-color] duration-200 ${
          isOpen ? "border-b border-black/[0.08]" : "border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <StepBadge n={n} done={done} />
          <span className="text-[15px] font-bold">{label}</span>
        </div>
        {headerRight}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-[300ms] ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
        aria-hidden={!isOpen}
      >
        <div className={overflowVisible ? "overflow-visible" : "overflow-hidden"}>
          {/* Body contents are centred: the controls inside a step (the
              picker, the Connect/Update buttons) are fixed-width and would
              otherwise hang against the left edge of a much wider card. Done
              here rather than per-step so every step — and any future one —
              lines up the same way. */}
          <div className="flex flex-col items-center px-5 py-[14px] text-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
