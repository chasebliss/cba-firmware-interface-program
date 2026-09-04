import { useEffect, useRef } from "react";

// Canvas 2D fillStyle cannot resolve var(), so the accent is duplicated here
// as a literal. This is the standard's documented canvas exemption. Keep in
// sync with --accent in index.css.
const COLOR = "#ba8e51";
const PARTICLES_PER_DIGIT = 3;
const LIFETIME_MS = 1400;
const FONT_SIZE = 20;
const GRAVITY = 900;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: "0" | "1";
  birth: number;
}

// Reads the current on-screen position of each floating digit in the
// BinaryHero SVG so particles launch from where the user last saw them.
// Falls back to viewport center if the SVG isn't available.
const collectOrigins = (): { x: number; y: number; char: "0" | "1" }[] => {
  const obj = document.querySelector<HTMLObjectElement>(
    'object[aria-label="Binary illustration"]',
  );
  const doc = obj?.contentDocument;
  if (!obj || !doc) {
    return [
      { x: window.innerWidth / 2, y: window.innerHeight / 2, char: "1" },
    ];
  }
  const objRect = obj.getBoundingClientRect();
  const groups = Array.from(
    doc.querySelectorAll<SVGGElement>('[class^="move-"]'),
  );
  const origins: { x: number; y: number; char: "0" | "1" }[] = [];
  for (const g of groups) {
    const r = g.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const char: "0" | "1" = g.textContent?.trim() === "0" ? "0" : "1";
    origins.push({
      x: objRect.left + r.left + r.width / 2,
      y: objRect.top + r.top + r.height / 2,
      char,
    });
  }
  if (origins.length === 0) {
    return [
      { x: window.innerWidth / 2, y: window.innerHeight / 2, char: "1" },
    ];
  }
  return origins;
};

export const SuccessBurst = ({ trigger }: { trigger: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const origins = collectOrigins();
    const now = performance.now();
    const particles: Particle[] = [];
    for (const o of origins) {
      for (let i = 0; i < PARTICLES_PER_DIGIT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 220 + Math.random() * 260;
        particles.push({
          x: o.x,
          y: o.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 120,
          char: Math.random() < 0.5 ? "0" : "1",
          birth: now,
        });
      }
    }

    let rafId = 0;
    let lastFrame = performance.now();
    const draw = () => {
      const t = performance.now();
      const dt = Math.min(0.05, (t - lastFrame) / 1000);
      lastFrame = t;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = COLOR;
      ctx.font = `700 ${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";

      let anyAlive = false;
      for (const p of particles) {
        const age = (t - p.birth) / LIFETIME_MS;
        if (age >= 1) continue;
        anyAlive = true;
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - age;
        ctx.fillText(p.char, p.x, p.y);
      }
      ctx.globalAlpha = 1;

      if (anyAlive) {
        rafId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    draw();

    return () => cancelAnimationFrame(rafId);
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-1001"
      aria-hidden="true"
    />
  );
};
