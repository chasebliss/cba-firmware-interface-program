import { useEffect, useState, type ReactNode } from "react";

const BODY_TRANSITION_MS = 300;

interface StepBadgeProps {
  n: number;
  done: boolean;
}

export const StepBadge = ({ n, done }: StepBadgeProps) => {
  return (
    <span
      className={`cba-step-badge flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-[13px] font-bold transition-colors duration-[250ms] ${
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
      className="relative -mb-[2px] border-2 border-black transition-[background,opacity] duration-500"
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
          <div className="px-5 py-[14px]">{children}</div>
        </div>
      </div>
    </div>
  );
};
