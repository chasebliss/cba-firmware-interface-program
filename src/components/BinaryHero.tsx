import { useEffect, useRef } from "react";

// Where digits stream TOWARD — roughly the left edge of the pedal body in the
// SVG's viewBox coordinates (viewBox="0 0 396 144"). Pedal outline starts
// around x≈323; overshooting slightly makes them look absorbed rather than
// stopping at the edge.
const TARGET_X = 330;
const TARGET_Y = 75;
// Where digits spawn — just past the computer's right edge so they don't
// ghost through it. Computer body ends around x≈110.
const ENTRY_X = 118;
const FLASH_RATE = 4;

interface DigitConfig {
  group: SVGGElement;
  startX: number;
  endX: number;
  endY: number;
  baseDuration: number;
  baseDelay: number;
}

interface BinaryHeroProps {
  flashing?: boolean;
}

export const BinaryHero = ({ flashing = false }: BinaryHeroProps) => {
  const objectRef = useRef<HTMLObjectElement>(null);
  const configsRef = useRef<DigitConfig[]>([]);
  const animationsRef = useRef<Animation[]>([]);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;

    let cancelled = false;
    let initialized = false;
    let interval = 0;

    const startAnimations = (rate: number) => {
      for (const a of animationsRef.current) a.cancel();
      animationsRef.current = [];
      for (const cfg of configsRef.current) {
        const anim = cfg.group.animate(
          [
            { translate: `${cfg.startX}px 0`, opacity: 0, offset: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.7 },
            {
              translate: `${cfg.endX}px ${cfg.endY}px`,
              opacity: 0,
              offset: 1,
            },
          ],
          {
            duration: cfg.baseDuration / rate,
            delay: cfg.baseDelay / rate,
            iterations: Infinity,
            easing: "linear",
          },
        );
        animationsRef.current.push(anim);
      }
    };

    const apply = () => {
      if (cancelled) return true;
      if (initialized) return true;
      const doc = obj.contentDocument;
      if (!doc || !doc.documentElement) return false;
      const groups = Array.from(
        doc.querySelectorAll<SVGGElement>('[class^="move-"]'),
      );
      if (groups.length === 0) return false;

      for (const g of groups) {
        const box = g.getBBox();
        if (box.width === 0 && box.height === 0) return false;
      }

      initialized = true;
      const svgNs = "http://www.w3.org/2000/svg";
      const configs: DigitConfig[] = [];
      for (const g of groups) {
        const box = g.getBBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        g.innerHTML = "";
        const text = doc.createElementNS(svgNs, "text");
        text.setAttribute("x", cx.toString());
        text.setAttribute("y", cy.toString());
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "central");
        text.setAttribute(
          "font-family",
          "ui-monospace, SFMono-Regular, Menlo, monospace",
        );
        text.setAttribute("font-size", "11");
        text.setAttribute("font-weight", "700");
        text.setAttribute("fill", "#ba8e51");
        text.textContent = Math.random() < 0.5 ? "0" : "1";
        g.appendChild(text);

        const baseDuration = 2800 + Math.random() * 1600;
        configs.push({
          group: g,
          startX: ENTRY_X - cx,
          endX: TARGET_X - cx,
          endY: TARGET_Y - cy,
          baseDuration,
          baseDelay: -Math.random() * baseDuration,
        });
      }
      configsRef.current = configs;
      startAnimations(flashing ? FLASH_RATE : 1);
      return true;
    };

    if (!apply()) {
      obj.addEventListener("load", apply);
      interval = window.setInterval(() => {
        if (apply()) window.clearInterval(interval);
      }, 100);
      window.setTimeout(() => window.clearInterval(interval), 5000);
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      obj.removeEventListener("load", apply);
      for (const a of animationsRef.current) a.cancel();
      animationsRef.current = [];
      configsRef.current = [];
    };
    // flashing intentionally omitted — we want the setup to run only once;
    // the other effect handles rate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (configsRef.current.length === 0) return;
    const rate = flashing ? FLASH_RATE : 1;
    for (const a of animationsRef.current) a.cancel();
    animationsRef.current = [];
    for (const cfg of configsRef.current) {
      const anim = cfg.group.animate(
        [
          { translate: `${cfg.startX}px 0`, opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.7 },
          {
            translate: `${cfg.endX}px ${cfg.endY}px`,
            opacity: 0,
            offset: 1,
          },
        ],
        {
          duration: cfg.baseDuration / rate,
          delay: cfg.baseDelay / rate,
          iterations: Infinity,
          easing: "linear",
        },
      );
      animationsRef.current.push(anim);
    }
  }, [flashing]);

  return (
    <object
      ref={objectRef}
      data="/binary.svg"
      type="image/svg+xml"
      aria-label="Binary illustration"
      className="pointer-events-none w-[500px] max-w-full opacity-85"
    />
  );
};
