import { useEffect, useRef, useState } from "react";

// Two pieces because the live site visually separates them: the bar sits
// between the binary illustration and the dropdown, while the status pill
// takes the place of the Connect/Update buttons.

export type FlashStatus =
  | "idle"
  | "preparing"
  | "installing"
  | "complete"
  | "error";

interface FlashProgressBarProps {
  done: number;
  total: number;
  bgColor: string;
  errored: boolean;
  visible?: boolean;
}

export const FlashProgressBar = ({
  done,
  total,
  bgColor,
  errored,
  visible = true,
}: FlashProgressBarProps) => {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const realPercent = Math.round(ratio * 100);
  const display = useSmoothPercent(realPercent);
  return (
    <div
      className={`mb-2 flex w-96 max-w-full items-center gap-3 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div className="h-4 flex-1 bg-surface">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${ratio * 100}%`,
            background: errored ? "var(--bad)" : bgColor,
          }}
        />
      </div>
      <span className="w-10 text-right font-mono text-sm font-bold tabular-nums">
        {display}%
      </span>
    </div>
  );
};

// Lerp the displayed percent toward the real value each frame. Feels like an
// analog gauge instead of the stepped, discrete jumps you get from raw
// progress events.
const useSmoothPercent = (real: number) => {
  const [display, setDisplay] = useState(real);
  const currentRef = useRef(real);
  useEffect(() => {
    let rafId = 0;
    const step = () => {
      const delta = real - currentRef.current;
      if (Math.abs(delta) < 0.3) {
        currentRef.current = real;
        setDisplay(real);
        return;
      }
      currentRef.current += delta * 0.18;
      setDisplay(Math.round(currentRef.current));
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [real]);
  return display;
};

interface FlashStatusPillProps {
  status: Exclude<FlashStatus, "idle">;
  message?: string;
}

export const FlashStatusPill = ({ status, message }: FlashStatusPillProps) => {
  const isPulsing = status === "preparing" || status === "installing";

  let label: string;
  if (message) {
    label = message;
  } else if (status === "complete") {
    label = "Successful";
  } else if (status === "error") {
    label = "Update failed";
  } else if (status === "preparing") {
    label = "Preparing...";
  } else {
    label = "Installing...";
  }

  const colorClasses =
    status === "complete"
      ? "border-ok text-ok"
      : status === "error"
        ? "border-bad text-bad"
        : "border-ok text-ok";

  return (
    <p
      key={status}
      className={`flex h-[50px] w-[240px] items-center justify-center border-2 bg-surface px-3 py-2 text-center text-base font-bold shadow-cba ${colorClasses} ${isPulsing ? "animate-cba-pulse" : ""} ${status === "error" ? "animate-cba-shake" : ""}`}
    >
      {label}
    </p>
  );
};
