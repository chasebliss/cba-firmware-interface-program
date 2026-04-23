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
}

export const FlashProgressBar = ({
  done,
  total,
  bgColor,
  errored,
}: FlashProgressBarProps) => {
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const realPercent = Math.round(ratio * 100);
  const display = useScrambledPercent(realPercent);
  return (
    <div className="flex w-96 max-w-full items-center gap-3">
      <div className="h-4 flex-1 bg-cream">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${ratio * 100}%`,
            background: errored ? "var(--color-red)" : bgColor,
          }}
        />
      </div>
      <span className="w-10 text-right font-mono text-sm font-bold tabular-nums">
        {display}%
      </span>
    </div>
  );
};

const useScrambledPercent = (real: number) => {
  const [display, setDisplay] = useState<string>(`${real}`);
  const prevRef = useRef(real);
  useEffect(() => {
    if (prevRef.current === real) return;
    prevRef.current = real;
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i > 3) {
        setDisplay(`${real}`);
        clearInterval(id);
      } else {
        setDisplay(`${Math.floor(Math.random() * 100)}`);
      }
    }, 25);
    return () => clearInterval(id);
  }, [real]);
  return display;
};

interface FlashStatusPillProps {
  status: Exclude<FlashStatus, "idle">;
  message?: string;
}

export const FlashStatusPill = ({
  status,
  message,
}: FlashStatusPillProps) => {
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
      ? "border-green text-green"
      : status === "error"
        ? "border-red text-red"
        : "border-green text-green";

  return (
    <p
      key={status}
      className={`min-w-[204px] border-2 bg-cream px-4 py-2 text-center text-base font-bold shadow-cba ${colorClasses} ${isPulsing ? "animate-cba-pulse" : ""} ${status === "error" ? "animate-cba-shake" : ""}`}
    >
      {label}
    </p>
  );
};
