import { useState } from "react";

const MAC_STEPS = [
  "Select firmware from the dropdown.",
  "*Connect pedal via data-transfer micro USB.",
  "*Connect appropriate power supply (see manual).",
  'Click Connect — select "DFU in FS mode" in browser popup.',
  "Click Update.",
];

const WIN_STEPS = [
  "Install Windows driver (first time only — see below).",
  "Select firmware from the dropdown.",
  "*Connect pedal via data-transfer micro USB.",
  "*Connect appropriate power supply (see manual).",
  'Click Connect — select "DFU in FS mode" in browser popup.',
  "Click Update.",
];

const DRIVER_STEPS = [
  "Download Zadig (zadig.akeo.ie) and open it.",
  "Connect pedal (steps 3 & 4, in order).",
  'Options → List All Devices → "DFU in FS Mode".',
  "Click Upgrade Driver.",
];

interface InstructionsProps {
  os: "mac" | "win";
}

export const Instructions = ({ os }: InstructionsProps) => {
  const steps = os === "mac" ? MAC_STEPS : WIN_STEPS;

  return (
    <div>
      <p className="mb-3 text-[13px] font-bold italic">
        <span className="mr-1.5 bg-red px-[7px] py-[1px] not-italic text-white">
          Note
        </span>
        Your pedal may be damaged by uploading incorrect firmware.
      </p>
      <ol className="m-0 list-none p-0">
        {steps.map((step, i) => (
          <li
            key={i}
            className="pb-[7px] pl-[2em] -indent-[2em] text-sm leading-[1.6]"
          >
            <span className="inline-block w-[1.5em] pr-2 text-right font-bold">
              {i + 1}.
            </span>
            {step}
          </li>
        ))}
      </ol>
      <p className="mt-1 text-[12px] font-semibold italic text-black/40">
        {os === "mac"
          ? "*Steps 2 & 3 must be done in this order."
          : "*Steps 3 & 4 must be done in this order."}
      </p>
      {os === "win" && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-bold">Driver install</p>
          <video
            src="/zadig-install.mp4"
            controls
            className="mb-3 block w-full border-2 border-black"
          />
          <ol className="m-0 list-none p-0">
            {DRIVER_STEPS.map((step, i) => (
              <li
                key={i}
                className="pb-[5px] pl-[2em] -indent-[2em] text-[12px] leading-[1.55]"
              >
                <span className="inline-block w-[1.5em] pr-2 text-right font-bold">
                  {String.fromCharCode(97 + i)}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

interface OSTabsProps {
  os: "mac" | "win";
  onChange: (os: "mac" | "win") => void;
}

export const OSTabs = ({ os, onChange }: OSTabsProps) => {
  return (
    <div className="mb-4 flex border-b border-black/[0.12]">
      {(["mac", "win"] as const).map((id) => {
        const active = os === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`-mb-px cursor-pointer border-none bg-transparent px-4 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 ${
              active
                ? "border-b-2 border-black text-black"
                : "border-b-2 border-transparent text-black/30"
            }`}
          >
            {id === "mac" ? "macOS" : "Windows"}
          </button>
        );
      })}
    </div>
  );
};

export const InstructionsPanel = () => {
  const [os, setOs] = useState<"mac" | "win">("mac");
  return (
    <div>
      <p className="mb-2.5 text-[10px] text-gold font-bold uppercase tracking-widest ">
        Instructions
      </p>
      <OSTabs os={os} onChange={setOs} />
      <div key={os} className="animate-tab-fade">
        <Instructions os={os} />
      </div>
    </div>
  );
};
