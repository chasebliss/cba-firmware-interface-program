import { useEffect, useRef } from "react";

const COLOR = "#ba8e51";
const GRID_SIZE = 14;
const FONT_SIZE = 13;
const LIFETIME_MS = 600;
const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, [role="button"], [role="listbox"], [role="option"], [role="dialog"]';

export const MouseTrail = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    interface TrailPoint {
      x: number;
      y: number;
      birth: number;
      char: "0" | "1";
    }
    let trail: TrailPoint[] = [];

    const handleMove = (e: MouseEvent) => {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit?.closest(INTERACTIVE_SELECTOR)) return;
      const gx = Math.floor(e.clientX / GRID_SIZE) * GRID_SIZE;
      const gy = Math.floor(e.clientY / GRID_SIZE) * GRID_SIZE;
      const last = trail[trail.length - 1];
      if (!last || last.x !== gx || last.y !== gy) {
        trail.push({
          x: gx,
          y: gy,
          birth: performance.now(),
          char: Math.random() < 0.5 ? "0" : "1",
        });
      }
    };
    window.addEventListener("mousemove", handleMove);

    let rafId = 0;
    const draw = () => {
      const now = performance.now();
      trail = trail.filter((p) => now - p.birth < LIFETIME_MS);

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = COLOR;
      ctx.font = `700 ${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      for (const p of trail) {
        const age = (now - p.birth) / LIFETIME_MS;
        ctx.globalAlpha = 1 - age;
        ctx.fillText(p.char, p.x + GRID_SIZE, p.y);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-1000"
      aria-hidden="true"
    />
  );
};
