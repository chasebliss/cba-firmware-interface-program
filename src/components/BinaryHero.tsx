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

export const BinaryHero = () => {
  const objectRef = useRef<HTMLObjectElement>(null);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;

    const animations: Animation[] = [];
    let initialized = false;

    const apply = () => {
      if (initialized) return true;
      const doc = obj.contentDocument;
      if (!doc || !doc.documentElement) return false;
      const groups = Array.from(
        doc.querySelectorAll<SVGGElement>('[class^="move-"]'),
      );
      if (groups.length === 0) return false;

      for (const g of groups) {
        const box = g.getBBox();
        if (box.width === 0 && box.height === 0) return false; // not laid out yet
      }

      initialized = true;
      const svgNs = "http://www.w3.org/2000/svg";
      for (const g of groups) {
        const box = g.getBBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // Replace the hand-drawn path with a <text> element styled to match
        // the MouseTrail. Centered on the path's original bbox so positions
        // don't shift.
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

        const startX = ENTRY_X - cx;
        const endX = TARGET_X - cx;
        const endY = TARGET_Y - cy;
        const duration = 2800 + Math.random() * 1600;
        const delay = -Math.random() * duration;

        const anim = g.animate(
          [
            { translate: `${startX}px 0`, opacity: 0, offset: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.7 },
            { translate: `${endX}px ${endY}px`, opacity: 0, offset: 1 },
          ],
          {
            duration,
            delay,
            iterations: Infinity,
            easing: "linear",
          },
        );
        animations.push(anim);
      }
      return true;
    };

    // try immediately in case the SVG is already loaded
    if (!apply()) {
      obj.addEventListener("load", apply);
      // poll as a backup — load event on <object> can be flaky
      const interval = window.setInterval(() => {
        if (apply()) window.clearInterval(interval);
      }, 100);
      window.setTimeout(() => window.clearInterval(interval), 5000);
    }

    return () => {
      obj.removeEventListener("load", apply);
      for (const a of animations) a.cancel();
    };
  }, []);

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
