import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

export type LockupAnimation =
  | "cascadeLR"
  | "fromOrigin"
  | "dropIn"
  | "wipeIn"
  | "typewriter"
  | "blurFocus"
  | "fadeUp"
  | "wordByWord"
  | "wave"
  | "breathe"
  | "heartbeat";

interface LogoLockupProps {
  src: string;
  width?: number | string;
  animation?: LockupAnimation;
  replayKey?: number;
  className?: string;
}

const SVG_NS = "http://www.w3.org/2000/svg";

export const LogoLockup = ({
  src,
  width,
  animation = "cascadeLR",
  replayKey = 0,
  className = "",
}: LogoLockupProps) => {
  const objectRef = useRef<HTMLObjectElement>(null);

  useLayoutEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    let cancelled = false;
    let interval = 0;
    let tl: gsap.core.Timeline | null = null;
    let cleanupFns: (() => void)[] = [];

    const apply = () => {
      if (cancelled) return true;
      const doc = obj.contentDocument;
      if (!doc || !doc.documentElement) return false;
      const svg = doc.documentElement as unknown as SVGSVGElement;

      const elements = Array.from(
        svg.querySelectorAll<SVGGraphicsElement>(
          "path, rect, circle, polygon, ellipse",
        ),
      );
      if (elements.length === 0) return false;

      for (const el of elements) {
        try {
          const bbox = el.getBBox();
          if (
            bbox.width === 0 &&
            bbox.height === 0 &&
            el.tagName.toLowerCase() !== "circle"
          ) {
            return false;
          }
        } catch {
          return false;
        }
      }

      gsap.killTweensOf(elements);

      svg.setAttribute("overflow", "visible");

      const vbAttr = svg.getAttribute("viewBox") || "0 0 100 100";
      const vb = vbAttr.split(/\s+/).map(Number);
      const vbX = vb[0] ?? 0;
      const vbY = vb[1] ?? 0;
      const vbW = vb[2] ?? 100;
      const vbH = vb[3] ?? 100;
      const minDim = Math.min(vbW, vbH);

      // Expand viewBox so off-screen animation starts don't clip.
      const expandViewBox = (frac: number) => {
        const padX = vbW * frac;
        const padY = vbH * frac;
        svg.setAttribute(
          "viewBox",
          `${vbX - padX} ${vbY - padY} ${vbW + padX * 2} ${vbH + padY * 2}`,
        );
      };
      cleanupFns.push(() => svg.setAttribute("viewBox", vbAttr));

      const sortedLR = [...elements].sort(
        (a, b) => a.getBBox().x - b.getBBox().x,
      );

      const LOOP = { repeat: -1, repeatDelay: 1.0 };

      switch (animation) {
        case "cascadeLR": {
          expandViewBox(0.2);
          const off = vbW * 0.15;
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            sortedLR,
            { autoAlpha: 0, x: -off },
            {
              autoAlpha: 1,
              x: 0,
              duration: 0.6,
              stagger: 0.028,
              ease: "back.out(1.3)",
            },
          );
          break;
        }
        case "fromOrigin": {
          expandViewBox(0.6);
          const off = minDim * 0.55;
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          elements.forEach((el, i) => {
            const angle =
              (i / Math.max(elements.length, 1)) * Math.PI * 2;
            tl!.fromTo(
              el,
              {
                autoAlpha: 0,
                x: Math.cos(angle) * off,
                y: Math.sin(angle) * off,
                rotation: (i % 2 === 0 ? 1 : -1) * 120,
                scale: 0.3,
                transformOrigin: "50% 50%",
              },
              {
                autoAlpha: 1,
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                duration: 0.85,
                ease: "back.out(1.5)",
              },
              i * 0.05,
            );
          });
          break;
        }
        case "dropIn": {
          expandViewBox(0.5);
          const off = vbH * 0.5;
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            sortedLR,
            {
              autoAlpha: 0,
              y: -off,
              transformOrigin: "50% 50%",
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.65,
              stagger: 0.035,
              ease: "back.out(1.4)",
            },
          );
          break;
        }
        case "wipeIn": {
          const vb = (svg.getAttribute("viewBox") || "0 0 100 100")
            .split(/\s+/)
            .map(Number);
          const vbW = vb[2] ?? 100;
          const vbH = vb[3] ?? 100;

          let defs = svg.querySelector("defs");
          if (!defs) {
            defs = doc.createElementNS(SVG_NS, "defs");
            svg.insertBefore(defs, svg.firstChild);
          }

          const clipId = `wipeClip_${Math.random().toString(36).slice(2, 9)}`;
          const cp = doc.createElementNS(SVG_NS, "clipPath");
          cp.setAttribute("id", clipId);
          const r = doc.createElementNS(SVG_NS, "rect");
          r.setAttribute("x", String(vb[0] ?? 0));
          r.setAttribute("y", String(vb[1] ?? 0));
          r.setAttribute("width", "0");
          r.setAttribute("height", String(vbH));
          cp.appendChild(r);
          defs.appendChild(cp);

          const targetGroup =
            svg.querySelector<SVGGElement>("g") || (svg as unknown as SVGGElement);
          const prevClip = targetGroup.getAttribute("clip-path");
          targetGroup.setAttribute("clip-path", `url(#${clipId})`);

          cleanupFns.push(() => {
            cp.remove();
            if (prevClip) targetGroup.setAttribute("clip-path", prevClip);
            else targetGroup.removeAttribute("clip-path");
          });

          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            r,
            { attr: { width: 0 } },
            { attr: { width: vbW }, duration: 0.9, ease: "power2.out" },
          );
          break;
        }
        case "typewriter": {
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            sortedLR,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: 0.01,
              stagger: 0.025,
              ease: "steps(1)",
            },
          );
          break;
        }
        case "blurFocus": {
          expandViewBox(0.12);
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            sortedLR,
            { autoAlpha: 0, filter: "blur(10px)" },
            {
              autoAlpha: 1,
              filter: "blur(0px)",
              duration: 0.55,
              stagger: 0.03,
              ease: "power2.out",
            },
          );
          break;
        }
        case "fadeUp": {
          expandViewBox(0.5);
          const off = vbH * 0.4;
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          tl.fromTo(
            sortedLR,
            { autoAlpha: 0, y: off },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              stagger: 0.025,
              ease: "power2.out",
            },
          );
          break;
        }
        case "wordByWord": {
          // Two-row aware cluster reveal.
          const boxed = elements.map((el) => ({ el, box: el.getBBox() }));
          const sortedY = [...boxed].sort((a, b) => a.box.y - b.box.y);
          const medianY =
            sortedY[Math.floor(sortedY.length / 2)]?.box.y ?? 0;
          const topRow = boxed.filter((b) => b.box.y < medianY);
          const bottomRow = boxed.filter((b) => b.box.y >= medianY);
          topRow.sort((a, b) => a.box.x - b.box.x);
          bottomRow.sort((a, b) => a.box.x - b.box.x);

          const clusterByGap = (items: typeof boxed) => {
            if (items.length === 0) return [] as (typeof boxed)[];
            const gaps: number[] = [];
            for (let i = 1; i < items.length; i++) {
              const prev = items[i - 1].box;
              gaps.push(items[i].box.x - (prev.x + prev.width));
            }
            const avg =
              gaps.length > 0
                ? gaps.reduce((a, b) => a + b, 0) / gaps.length
                : 0;
            const out: (typeof boxed)[] = [[items[0]]];
            for (let i = 1; i < items.length; i++) {
              if (gaps[i - 1] > avg * 1.9) {
                out.push([items[i]]);
              } else {
                out[out.length - 1].push(items[i]);
              }
            }
            return out;
          };

          const groups = [
            ...clusterByGap(topRow),
            ...clusterByGap(bottomRow),
          ];

          expandViewBox(0.1);
          tl = gsap.timeline({ delay: 0.1, ...LOOP });
          let time = 0;
          for (const group of groups) {
            tl.fromTo(
              group.map((g) => g.el),
              { autoAlpha: 0, y: 8 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.35,
                stagger: 0.02,
                ease: "power2.out",
              },
              time,
            );
            time += 0.3;
          }
          break;
        }
        case "wave": {
          expandViewBox(0.12);
          gsap.set(elements, {
            autoAlpha: 1,
            transformOrigin: "50% 50%",
          });
          const amp = vbH * 0.06;
          sortedLR.forEach((el, i) => {
            gsap.to(el, {
              y: -amp,
              duration: 0.9,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
              delay: i * 0.07,
            });
          });
          tl = gsap.timeline();
          break;
        }
        case "breathe": {
          gsap.set(elements, { autoAlpha: 1 });
          tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(elements, {
            autoAlpha: 0.35,
            duration: 1.4,
            ease: "sine.inOut",
          });
          break;
        }
        case "heartbeat": {
          expandViewBox(0.1);
          gsap.set(elements, { autoAlpha: 1 });
          const group =
            svg.querySelector<SVGGElement>("g") ||
            (svg as unknown as SVGGElement);
          gsap.set(group, { transformOrigin: "50% 50%" });
          tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
          tl.to(group, { scale: 1.05, duration: 0.15, ease: "power2.out" })
            .to(group, { scale: 1, duration: 0.25, ease: "power2.inOut" })
            .to(group, { scale: 1.04, duration: 0.15, ease: "power2.out" })
            .to(group, { scale: 1, duration: 0.35, ease: "power2.inOut" });
          break;
        }
      }
      return true;
    };

    if (!apply()) {
      obj.addEventListener("load", apply);
      interval = window.setInterval(() => {
        if (apply()) window.clearInterval(interval);
      }, 80);
      window.setTimeout(() => window.clearInterval(interval), 3000);
    }

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      obj.removeEventListener("load", apply);
      if (tl) tl.kill();
      const doc = obj.contentDocument;
      if (doc) {
        const els = doc.querySelectorAll<SVGGraphicsElement>(
          "path, rect, circle, polygon, ellipse, g",
        );
        if (els.length > 0) gsap.killTweensOf(Array.from(els));
      }
      for (const fn of cleanupFns) fn();
      cleanupFns = [];
    };
  }, [src, animation, replayKey]);

  const style = width
    ? { width: typeof width === "number" ? `${width}px` : width }
    : undefined;

  return (
    <object
      ref={objectRef}
      data={src}
      type="image/svg+xml"
      aria-label="Chase Bliss logo"
      className={`pointer-events-none block ${className}`}
      style={style}
    />
  );
};
