import { useState } from "react";
import {
  LogoLockup,
  type LockupAnimation,
} from "@/components/LogoLockup";

interface LogoDef {
  id: string;
  label: string;
  src: string;
  width: number;
}

const LOGOS: LogoDef[] = [
  { id: "mark", label: "Logomark", src: "/logos/mark.svg", width: 220 },
  {
    id: "primary",
    label: "Primary (stacked wordmark)",
    src: "/logos/primary.svg",
    width: 340,
  },
  {
    id: "horizontal",
    label: "Horizontal",
    src: "/logos/horizontal.svg",
    width: 420,
  },
  {
    id: "stacked",
    label: "Stacked vertical",
    src: "/logos/stacked.svg",
    width: 260,
  },
  {
    id: "tagline",
    label: "Digital Brain / Analog Heart",
    src: "/logos/tagline.svg",
    width: 340,
  },
];

interface AnimationDef {
  id: LockupAnimation;
  label: string;
  continuous?: boolean;
}

const ANIMATIONS: AnimationDef[] = [
  { id: "typewriter", label: "Typewriter" },
  { id: "fadeUp", label: "Fade up" },
  { id: "wordByWord", label: "Word by word" },
  { id: "blurFocus", label: "Blur focus" },
  { id: "cascadeLR", label: "Cascade L→R" },
  { id: "dropIn", label: "Drop in" },
  { id: "wipeIn", label: "Wipe in" },
  { id: "fromOrigin", label: "From origin" },
  { id: "wave", label: "Wave", continuous: true },
  { id: "breathe", label: "Breathe", continuous: true },
  { id: "heartbeat", label: "Heartbeat", continuous: true },
];

export const LogoDemo = () => {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <div className="min-h-screen bg-cream px-[7vw] py-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-10 flex items-end justify-between border-b-2 border-black pb-6">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black/45">
              Playground
            </p>
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">
              Logo animation variants.
            </h1>
            <p className="mt-1 text-[12px] text-black/60">
              Each logo with every animation. Tiles marked{" "}
              <span className="mx-0.5 rounded-full border border-black/15 bg-black/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-black/60">
                loops
              </span>{" "}
              run continuously.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplayKey((k) => k + 1)}
            className="border-2 border-black bg-cream px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all hover:italic hover:shadow-[0_8px_20px_rgba(0,0,0,0.11)]"
          >
            Replay all
          </button>
        </div>

        <div className="flex flex-col gap-16">
          {LOGOS.map((logo) => (
            <section key={logo.id}>
              <div className="mb-5 flex items-baseline justify-between border-b border-black/15 pb-2">
                <h2 className="text-lg font-bold">{logo.label}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-black/45">
                  {ANIMATIONS.length} animations
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ANIMATIONS.map((anim) => (
                  <div
                    key={`${logo.id}-${anim.id}`}
                    className="flex flex-col rounded-sm border border-black/10 bg-white/60 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-black/55">
                        {anim.label}
                      </p>
                      {anim.continuous && (
                        <span className="rounded-full border border-black/15 bg-black/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-black/60">
                          loops
                        </span>
                      )}
                    </div>
                    <div className="flex min-h-[100px] flex-1 items-center justify-center">
                      <div
                        className="w-full"
                        style={{ maxWidth: logo.width }}
                      >
                        <LogoLockup
                          src={logo.src}
                          width="100%"
                          animation={anim.id}
                          replayKey={replayKey}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
