import { useEffect, useRef } from "react";

const COLOR = "#ba8e51";
const PARTICLE_COUNT = 40;
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

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const now = performance.now();
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 260 + Math.random() * 320;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 140,
        char: Math.random() < 0.5 ? "0" : "1",
        birth: now,
      });
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
      ctx.textBaseline = "top";
      ctx.textAlign = "left";

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
      className="pointer-events-none fixed inset-0 z-[1001]"
      aria-hidden="true"
    />
  );
};
