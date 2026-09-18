import { useRef, useState, type KeyboardEvent } from "react";

// Footnote markers ride alongside the copy rather than inside it, so the step
// text stays plain prose and the marker renders as a real superscript. As
// literal characters in the string they read as unrendered markdown.
type Step = { text: string; note?: 1 | 2 };

const NOTE_MARKS = ["*", "**"] as const;

const MAC_STEPS: Step[] = [
  { text: "Select firmware from the dropdown." },
  { text: "Connect pedal via data-transfer USB cable.", note: 2 },
  { text: "Connect appropriate power supply (see manual).", note: 1 },
  { text: 'Click Connect — select "DFU in FS mode" in browser popup.' },
  { text: "Click Update." },
];

const WIN_STEPS: Step[] = [
  { text: "Install Windows driver (first time only — see below)." },
  { text: "Select firmware from the dropdown." },
  { text: "Connect pedal via data-transfer USB cable.", note: 2 },
  { text: "Connect appropriate power supply (see manual).", note: 1 },
  { text: 'Click Connect — select "DFU in FS mode" in browser popup.' },
  { text: "Click Update." },
];

const DRIVER_STEPS = [
  "Download Zadig (zadig.akeo.ie) and open it.",
  "Connect pedal (steps 3 & 4, in order).",
  'Options → List All Devices → "DFU in FS Mode".',
  "Click Upgrade Driver.",
];

const AUTOMATONE_NOTE =
  "You will need to remove the left side panel to access the USB port on Automatone pedals. To release the panel, remove the two Phillips screws on the edge of the backplate, and the 2mm hex screws from both the top and bottom of the pedal.";

const TABS = [
  { id: "mac", label: "macOS" },
  { id: "win", label: "Windows" },
] as const;

type OS = (typeof TABS)[number]["id"];

// No size, weight or baseline class: the UA's own sup styling already sets
// these apart. Bolding them made two caveats shout louder than five steps.
const NoteMark = ({ n }: { n: 1 | 2 }) => <sup>{NOTE_MARKS[n - 1]}</sup>;

type InstructionsProps = {
  os: OS;
};

export const Instructions = ({ os }: InstructionsProps) => {
  const steps = os === "mac" ? MAC_STEPS : WIN_STEPS;
  const orderNote =
    os === "mac"
      ? "Steps 2 & 3 must be done in this order."
      : "Steps 3 & 4 must be done in this order.";

  return (
    <div>
      {/* The red now rides on a drawn mark rather than a filled badge. As a
       * graphic, --bad clears the 3:1 non-text threshold (3.65:1 on cream);
       * as 13px text it would have missed 4.5:1. The sentence stays dark. */}
      <p className="mb-4 flex items-start gap-2 text-body-sm font-bold">
        <svg
          className="mt-px h-4 w-4 shrink-0 text-bad"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
          />
        </svg>
        <span>Your pedal may be damaged by uploading incorrect firmware.</span>
      </p>
      {/* A real ordered list: the browser hangs wrapped lines off the marker
       * exactly, which the hand-rolled number span missed by 1px. */}
      <ol className="m-0 list-decimal pl-[1.55em] text-body-sm leading-relaxed">
        {steps.map((step, i) => (
          <li key={i} className="pb-1.5">
            {step.text}
            {step.note && <NoteMark n={step.note} />}
          </li>
        ))}
      </ol>
      <div className="mt-2 text-caption leading-relaxed text-text/65">
        <p>
          <NoteMark n={1} />
          {orderNote}
        </p>
        <p>
          <NoteMark n={2} />
          {AUTOMATONE_NOTE}
        </p>
      </div>
      {os === "win" && (
        <div className="mt-4">
          <p className="mb-2 text-body-sm font-semibold">Driver install</p>
          {/* Intrinsic dimensions reserve the box before the file loads, so
           * switching to this tab does not shift the steps below it. */}
          <video
            src="/zadig-install.mp4"
            controls
            preload="metadata"
            width={2560}
            height={1516}
            aria-label="Zadig driver install walkthrough"
            className="mb-3 block h-auto w-full border-2 border-border"
          />
          <ol className="m-0 list-[lower-alpha] pl-[1.55em] text-caption leading-relaxed">
            {DRIVER_STEPS.map((step, i) => (
              <li key={i} className="pb-1.5">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

type OSTabsProps = {
  os: OS;
  onChange: (os: OS) => void;
};

export const OSTabs = ({ os, onChange }: OSTabsProps) => {
  const refs = useRef<Partial<Record<OS, HTMLButtonElement | null>>>({});

  // Roving tabindex: the tablist is one tab stop, arrows move between tabs.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === os);
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % TABS.length
        : e.key === "ArrowLeft"
          ? (i - 1 + TABS.length) % TABS.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? TABS.length - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(TABS[next].id);
    refs.current[TABS[next].id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Operating system"
      onKeyDown={handleKeyDown}
      className="mb-4 flex border-b border-border/10"
    >
      {TABS.map(({ id, label }) => {
        const active = os === id;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            id={`os-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`os-panel-${id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(id)}
            /* Margin, not padding, so the active rule hugs the word and the
             * first tab sits flush with the step text below it. */
            className={`-mb-px mr-5 cursor-pointer border-b-2 bg-transparent pb-2 font-sans text-body-sm font-semibold transition-colors duration-150 ${
              active
                ? "border-border text-text"
                : "border-transparent text-text/60 hover:text-text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export const InstructionsPanel = () => {
  const [os, setOs] = useState<OS>("mac");
  return (
    <div>
      {/* The gold eyebrow restated what the tabs already show, and gold on
       * cream reads at 2.88:1. The tabs are the heading now; the label stays
       * for screen readers and document outline. */}
      <h2 className="sr-only">Instructions</h2>
      <OSTabs os={os} onChange={setOs} />
      <div
        key={os}
        id={`os-panel-${os}`}
        role="tabpanel"
        aria-labelledby={`os-tab-${os}`}
        tabIndex={0}
        className="animate-tab-fade"
      >
        <Instructions os={os} />
      </div>
    </div>
  );
};
