import { useId, useLayoutEffect, useRef } from "react";
import gsap from "gsap";

export type LogoTextAnimation =
  | "typewriter"
  | "scanline"
  | "draw"
  | "glitch"
  | "blur"
  | "flicker";

let hasPlayed = false;

interface LogoProps {
  className?: string;
  width?: number | string;
  animate?: boolean;
  textAnimation?: LogoTextAnimation;
  replayable?: boolean;
  // Loop the text animation (draw in → pause → draw out → pause → ...).
  // Only wired for the "draw" animation today; other variants stay one-shot.
  loop?: boolean;
}

const VIEWBOX_W = 776.71;
const VIEWBOX_H = 102.88;

export const Logo = ({
  className = "",
  width,
  animate = true,
  textAnimation = "draw",
  replayable = false,
  loop = true,
}: LogoProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const reactId = useId();
  const clipId = `logoScanClip${reactId.replace(/[:.]/g, "")}`;

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || !animate) return;

    const mark = Array.from(
      svg.querySelectorAll<SVGGraphicsElement>(".logo-mark > *"),
    );
    const glyphs = Array.from(
      svg.querySelectorAll<SVGGraphicsElement>(".logo-wordmark > *"),
    ).sort((a, b) => a.getBBox().x - b.getBBox().x);
    const all = [...mark, ...glyphs];

    if (!replayable && !loop && hasPlayed) {
      gsap.set(all, { clearProps: "all" });
      return;
    }

    const [scoop, shield, diamond] = mark;

    // Each shape hops in from the left, arcing across the frame to its
    // final spot while spinning like a rolling ball. Arc = horizontal
    // x-tween + y up-then-down keyframes; rotation runs in parallel; scale
    // squash on landing gives the ball-hits-floor feel. Center transform
    // origin so rotation pivots correctly; squash compresses toward middle.
    gsap.set(all, { autoAlpha: 0, transformOrigin: "50% 50%" });
    gsap.set(scoop, { x: -240, y: 0, rotation: 0 });
    gsap.set(shield, { x: -300, y: 0, rotation: 0 });
    gsap.set(diamond, { x: -200, y: 0, rotation: 0 });

    // Arrivals stagger so you see 3 distinct hops bouncing in sequence.
    const SCOOP_START = 0;
    const SHIELD_START = 0.45;
    const DIAMOND_START = 0.9;
    const TRAVEL = 0.8; // shared hop duration

    // Silly looping antics after the intro — string of little character
    // moments that don't repeat within a single cycle. All rotation tweens
    // use relative (+=/-=) values so they stack cleanly on the absolute
    // rotation left by the intro (no accidental upside-down frames).
    let markLoopTl: gsap.core.Timeline | null = null;
    const startMarkLoop = () => {
      if (markLoopTl || !loop) return;
      markLoopTl = gsap.timeline({
        delay: 0.8,
        repeat: -1,
        repeatDelay: 3,
      });

      // 1) DIAMOND hops high with a spin, hovers at the peak, drops back
      //    with a squash-and-settle.
      markLoopTl
        .to(diamond, {
          y: -55,
          rotation: "+=360",
          duration: 0.55,
          ease: "power2.out",
        })
        .to(diamond, { y: -62, duration: 0.25, ease: "sine.inOut" })
        .to(diamond, { y: 0, duration: 0.4, ease: "bounce.out" })
        .to(
          diamond,
          {
            keyframes: [
              { scaleY: 0.7, scaleX: 1.25, duration: 0.07 },
              { scaleY: 1.06, scaleX: 0.97, duration: 0.12 },
              {
                scaleY: 1,
                scaleX: 1,
                duration: 0.3,
                ease: "elastic.out(1, 0.5)",
              },
            ],
            ease: "none",
          },
          "-=0.18",
        );

      // 2) SHIELD rocks side-to-side like a metronome, then centers.
      markLoopTl
        .to(
          shield,
          { rotation: "+=12", duration: 0.2, ease: "power2.out" },
          "+=0.3",
        )
        .to(shield, { rotation: "-=24", duration: 0.25, ease: "sine.inOut" })
        .to(shield, {
          rotation: "+=12",
          duration: 0.3,
          ease: "elastic.out(1, 0.5)",
        });

      // 3) DOMINO WAVE — scoop hops, shield hops, diamond hops in quick
      //    sequence. Stadium-wave feel.
      markLoopTl
        .to(
          scoop,
          { y: -14, duration: 0.18, ease: "power2.out" },
          "+=0.3",
        )
        .to(scoop, { y: 0, duration: 0.28, ease: "bounce.out" })
        .to(
          shield,
          { y: -14, duration: 0.18, ease: "power2.out" },
          "-=0.35",
        )
        .to(shield, { y: 0, duration: 0.28, ease: "bounce.out" })
        .to(
          diamond,
          { y: -14, duration: 0.18, ease: "power2.out" },
          "-=0.35",
        )
        .to(diamond, { y: 0, duration: 0.28, ease: "bounce.out" });

      // 3.5) PARADE — all three pop to the right one by one with a mini
      //      spin, gather on the right and do a group wiggle, then parade
      //      back left together to their original spots.
      markLoopTl
        .to(
          scoop,
          {
            x: 42,
            y: -24,
            rotation: "+=360",
            duration: 0.4,
            ease: "power2.out",
          },
          "+=0.3",
        )
        .to(scoop, { y: 0, duration: 0.3, ease: "bounce.out" })
        .to(
          shield,
          {
            x: 42,
            y: -24,
            rotation: "+=360",
            duration: 0.4,
            ease: "power2.out",
          },
          "-=0.35",
        )
        .to(shield, { y: 0, duration: 0.3, ease: "bounce.out" })
        .to(
          diamond,
          {
            x: 42,
            y: -24,
            rotation: "+=360",
            duration: 0.4,
            ease: "power2.out",
          },
          "-=0.35",
        )
        .to(diamond, { y: 0, duration: 0.3, ease: "bounce.out" })
        // Group wiggle on the right — small rotation shimmy while huddled.
        .to(
          [scoop, shield, diamond],
          {
            rotation: "+=6",
            duration: 0.15,
            ease: "sine.inOut",
            yoyo: true,
            repeat: 3,
          },
          "+=0.15",
        )
        // Parade back to the left, staggered.
        .to(
          [scoop, shield, diamond],
          {
            x: 0,
            y: -22,
            rotation: "-=360",
            duration: 0.4,
            ease: "power2.out",
            stagger: 0.08,
          },
          "+=0.2",
        )
        .to(
          [scoop, shield, diamond],
          {
            y: 0,
            duration: 0.3,
            ease: "bounce.out",
            stagger: 0.08,
          },
          "-=0.3",
        );

      // 4) SCOOP shuffles out to the left, does a double-take head wobble,
      //    shuffles back to its spot.
      markLoopTl
        .to(
          scoop,
          {
            x: -28,
            y: -6,
            rotation: "-=18",
            duration: 0.32,
            ease: "power2.out",
          },
          "+=0.3",
        )
        .to(scoop, { y: 0, duration: 0.22, ease: "bounce.out" })
        .to(scoop, {
          rotation: "+=8",
          duration: 0.15,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        })
        .to(scoop, {
          x: 0,
          // Return trip fully cancels the -18 tilt on the way out so
          // scoop lands back at exactly the same rotation each cycle.
          rotation: "+=18",
          y: -6,
          duration: 0.32,
          ease: "power2.out",
        })
        .to(scoop, { y: 0, duration: 0.25, ease: "bounce.out" });

      // 5) DIAMOND does a solo pencil-spin in place — full 720° twirl, no
      //    vertical movement.
      markLoopTl.to(
        diamond,
        { rotation: "+=720", duration: 0.85, ease: "power2.inOut" },
        "+=0.3",
      );

      // 6) SHIELD slow-scan — tilts slowly left, holds, tilts slowly right,
      //    centers. Reads as "looking around."
      markLoopTl
        .to(
          shield,
          { rotation: "-=18", duration: 0.55, ease: "sine.inOut" },
          "+=0.25",
        )
        .to(shield, { duration: 0.2 })
        .to(shield, {
          rotation: "+=36",
          duration: 0.65,
          ease: "sine.inOut",
        })
        .to(shield, { duration: 0.2 })
        .to(shield, {
          rotation: "-=18",
          duration: 0.45,
          ease: "elastic.out(1, 0.5)",
        });

      // 7) SCOOP shivers — six rapid tiny wobbles, like it got the chills.
      markLoopTl.to(
        scoop,
        {
          keyframes: [
            { x: -2, rotation: "-=2", duration: 0.05 },
            { x: 2, rotation: "+=4", duration: 0.05 },
            { x: -2, rotation: "-=4", duration: 0.05 },
            { x: 2, rotation: "+=4", duration: 0.05 },
            { x: -2, rotation: "-=4", duration: 0.05 },
            {
              x: 0,
              rotation: "+=2",
              duration: 0.15,
              ease: "elastic.out(1, 0.5)",
            },
          ],
          ease: "none",
        },
        "+=0.25",
      );

      // 7.5) HEAD BOB — all three pulse y together in a 3-beat rhythm,
      //      like dancing to a beat.
      markLoopTl.to(
        [scoop, shield, diamond],
        {
          y: -8,
          duration: 0.17,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 5,
        },
        "+=0.3",
      );

      // 8) All three BREATHE — synchronized slow scale pulse, twice. Like
      //    the logo is inhaling / exhaling.
      markLoopTl
        .to(
          [scoop, shield, diamond],
          { scale: 1.06, duration: 0.55, ease: "sine.inOut" },
          "+=0.35",
        )
        .to([scoop, shield, diamond], {
          scale: 1,
          duration: 0.55,
          ease: "sine.inOut",
        })
        .to([scoop, shield, diamond], {
          scale: 1.06,
          duration: 0.55,
          ease: "sine.inOut",
        })
        .to([scoop, shield, diamond], {
          scale: 1,
          duration: 0.55,
          ease: "sine.inOut",
        });

      // 9) GROUP CHEER — everyone hops up together, lands with elastic
      //    settle. Big closing flourish before the pause + loop restart.
      markLoopTl
        .to(
          [scoop, shield, diamond],
          { y: -24, scale: 0.94, duration: 0.32, ease: "power2.out" },
          "+=0.35",
        )
        .to([scoop, shield, diamond], {
          y: 0,
          scale: 1,
          duration: 0.55,
          ease: "elastic.out(1, 0.55)",
        });
    };

    const tl = gsap.timeline({
      delay: 0.1,
      onComplete: () => {
        if (!replayable) hasPlayed = true;
        startMarkLoop();
      },
    });

    // Helper: a single left-to-right hop landing at (x: 0, y: 0).
    //   x-tween runs linear across the whole travel (horizontal drift)
    //   y-tween arcs up-then-down with sine eases (gravity feel)
    //   rotation spins like a rolling ball mid-flight
    //   scale-tween stays flat during travel, then squash-stretch-settle
    const hopIn = (
      el: SVGGraphicsElement,
      startAt: number,
      peakHeight: number,
      spin: number,
    ) => {
      tl.set(el, { autoAlpha: 1 }, startAt)
        .to(el, { x: 0, duration: TRAVEL, ease: "power1.inOut" }, startAt)
        // Linear rotation so the spin reads at constant speed through the
        // whole arc — no slow-in/slow-out that makes the rotation feel
        // compressed at the end.
        .to(
          el,
          { rotation: spin, duration: TRAVEL, ease: "none" },
          startAt,
        )
        .to(
          el,
          {
            keyframes: [
              { y: -peakHeight, duration: TRAVEL * 0.5, ease: "sine.out" },
              { y: 0, duration: TRAVEL * 0.4, ease: "sine.in" },
            ],
            ease: "none",
          },
          startAt,
        )
        .to(
          el,
          {
            keyframes: [
              // travel phase: slight stretch to lean into motion
              { scaleY: 1.08, scaleX: 0.94, duration: TRAVEL * 0.9 },
              // impact: squash (compress vertically, widen horizontally)
              { scaleY: 0.7, scaleX: 1.22, duration: 0.06 },
              // rebound: stretch back up
              { scaleY: 1.06, scaleX: 0.97, duration: 0.12 },
              // settle: elastic overshoot to rest
              {
                scaleY: 1,
                scaleX: 1,
                duration: 0.25,
                ease: "elastic.out(1, 0.5)",
              },
            ],
            ease: "none",
          },
          startAt,
        );
    };

    // 1) Scoop hops in — modest arc, one full clockwise spin, lands first.
    hopIn(scoop, SCOOP_START, 55, 360);

    // 2) Shield hops in — higher arc, one full turn. Scoop bumps from the
    //    impact beside it (overlapping action).
    hopIn(shield, SHIELD_START, 65, 360);
    tl.to(
      scoop,
      {
        keyframes: [
          { x: -3, scaleY: 0.95, duration: 0.08 },
          { x: 0, scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" },
        ],
        ease: "none",
      },
      SHIELD_START + TRAVEL * 0.9,
    );

    // 3) Diamond hops in — highest arc to land on top, 2 full spins. Stack
    //    compresses briefly when it touches down (secondary action).
    hopIn(diamond, DIAMOND_START, 80, 720);
    tl.to(
      [scoop, shield],
      {
        keyframes: [
          { scaleY: 0.93, duration: 0.08 },
          { scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" },
        ],
        ease: "none",
      },
      DIAMOND_START + TRAVEL * 0.9,
    );

    // Text starts with the shapes at t=0 and finishes roughly when the
    // stack has settled, so both halves of the intro open and close in
    // sync instead of running back-to-back.
    const textStart = 0;

    // Helpers for the "draw" text animation — extracted so both the intro
    // and the hover-replay can reuse them.
    const primeDrawState = () => {
      glyphs.forEach((el) => {
        const totalLen =
          "getTotalLength" in el && typeof el.getTotalLength === "function"
            ? (el as SVGPathElement).getTotalLength()
            : 0;
        if (totalLen > 0) {
          gsap.set(el, {
            autoAlpha: 1,
            strokeDasharray: totalLen,
            strokeDashoffset: totalLen,
            fillOpacity: 0,
            stroke: "currentColor",
            strokeWidth: 1.5,
          });
        } else {
          gsap.set(el, { autoAlpha: 0 });
        }
      });
    };
    const queueDrawTweens = (
      target: gsap.core.Timeline,
      at: number | string = 0,
    ) => {
      // Stretched to run alongside the full mark entrance — starts with
      // the shapes at t=0 and wraps up around the same time they settle
      // (~2s) instead of being a quick follow-up.
      target
        .to(
          glyphs,
          {
            strokeDashoffset: 0,
            autoAlpha: 1,
            duration: 1.3,
            stagger: 0.04,
            ease: "power2.inOut",
          },
          at,
        )
        .to(
          glyphs,
          {
            fillOpacity: 1,
            strokeWidth: 0,
            duration: 0.4,
            stagger: 0.04,
            ease: "power1.out",
          },
          typeof at === "number" ? at + 1.0 : "-=0.3",
        );
    };

    switch (textAnimation) {
      case "typewriter": {
        tl.to(
          glyphs,
          {
            autoAlpha: 1,
            duration: 0.01,
            stagger: 0.04,
            ease: "steps(1)",
          },
          textStart,
        );
        break;
      }
      case "scanline": {
        const scanRect = svg.querySelector<SVGRectElement>(
          `#${clipId} rect`,
        );
        gsap.set(glyphs, { autoAlpha: 1 });
        if (scanRect) {
          gsap.set(scanRect, { attr: { width: 0 } });
          tl.to(
            scanRect,
            {
              attr: { width: VIEWBOX_W },
              duration: 0.75,
              ease: "power2.out",
            },
            textStart,
          );
        }
        break;
      }
      case "draw": {
        primeDrawState();
        queueDrawTweens(tl, textStart);
        break;
      }
      case "glitch": {
        gsap.set(glyphs, { autoAlpha: 0 });
        glyphs.forEach((el, i) => {
          tl.fromTo(
            el,
            { autoAlpha: 0, x: 0 },
            {
              duration: 0.25,
              ease: "steps(4)",
              keyframes: [
                { autoAlpha: 1, x: 4 },
                { autoAlpha: 0.4, x: -4 },
                { autoAlpha: 1, x: 2 },
                { autoAlpha: 0.7, x: -1 },
                { autoAlpha: 1, x: 0 },
              ],
            },
            textStart + i * 0.04,
          );
        });
        break;
      }
      case "blur": {
        gsap.set(glyphs, { filter: "blur(10px)", autoAlpha: 0 });
        tl.to(
          glyphs,
          {
            autoAlpha: 1,
            filter: "blur(0px)",
            duration: 0.5,
            stagger: 0.04,
            ease: "power2.out",
          },
          textStart,
        );
        break;
      }
      case "flicker": {
        gsap.set(glyphs, { autoAlpha: 0 });
        glyphs.forEach((el, i) => {
          tl.fromTo(
            el,
            { autoAlpha: 0 },
            {
              duration: 0.25,
              keyframes: [
                { autoAlpha: 0.9 },
                { autoAlpha: 0 },
                { autoAlpha: 1 },
                { autoAlpha: 0.2 },
                { autoAlpha: 1 },
              ],
              ease: "steps(5)",
            },
            textStart + i * 0.05,
          );
        });
        break;
      }
    }

    return () => {
      tl.kill();
      if (markLoopTl) markLoopTl.kill();
      gsap.set(all, { clearProps: "all" });
    };
  }, [animate, textAnimation, replayable, clipId, loop]);

  const style = width
    ? { width: typeof width === "number" ? `${width}px` : width }
    : undefined;

  const wordmarkClip =
    textAnimation === "scanline" ? `url(#${clipId})` : undefined;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      fill="currentColor"
      aria-label="Chase Bliss"
      overflow="visible"
      className={`block ${className}`}
      style={style}
    >
      {textAnimation === "scanline" && (
        <defs>
          <clipPath id={clipId}>
            <rect
              x="0"
              y="0"
              width={VIEWBOX_W}
              height={VIEWBOX_H}
            />
          </clipPath>
        </defs>
      )}
      <g className="logo-mark">
        <path d="M7.84,53.11a63.34,63.34,0,0,0-7.84.5v49.27H70.38A64.2,64.2,0,0,0,7.84,53.11Z" />
        <path d="M90,51.44a12.86,12.86,0,0,1,12.86-12.86V0A51.45,51.45,0,0,0,53.22,38L53.06,38.59a51.48,51.48,0,0,0,49.82,64.29V64.3A12.86,12.86,0,0,1,90,51.44Z" />
        <path d="M38.22,0L0,15.09L15.14,53.54L53.06,38.59Z" />
      </g>
      <g
        className="logo-wordmark"
        transform="translate(0 10)"
        clipPath={wordmarkClip}
      >
        <path d="M658,19.75v63H645.36v-63Z" />
        <path d="M682.94,80.11a22.58,22.58,0,0,1-9-7.09,17.69,17.69,0,0,1-3.56-10h13a8.91,8.91,0,0,0,3.72,6.48,13.46,13.46,0,0,0,8.47,2.6c3.54,0,6.31-.68,8.26-2a6.17,6.17,0,0,0,2.93-5.25,5.43,5.43,0,0,0-3.25-5.1A61.29,61.29,0,0,0,693.19,56,99.23,99.23,0,0,1,682,52.4,19.62,19.62,0,0,1,674.52,47q-3.15-3.6-3.15-9.64a15,15,0,0,1,2.87-8.92A19.19,19.19,0,0,1,682.52,22a30.75,30.75,0,0,1,12.35-2.32q10.41,0,16.79,5.25t6.81,14.35H705.84a9,9,0,0,0-3.33-6.54q-3-2.43-8.11-2.43t-7.64,1.88a5.83,5.83,0,0,0-2.71,5,5.41,5.41,0,0,0,1.81,4.09,12.66,12.66,0,0,0,4.32,2.61q2.55.94,7.54,2.38a82.47,82.47,0,0,1,10.91,3.61A20.42,20.42,0,0,1,716,55.28a14.27,14.27,0,0,1,3.21,9.41A15.81,15.81,0,0,1,716.33,74a19.11,19.11,0,0,1-8.12,6.43,30.42,30.42,0,0,1-12.35,2.33A30.9,30.9,0,0,1,682.94,80.11Z" />
        <path d="M740.46,80.11a22.55,22.55,0,0,1-9-7.09,17.59,17.59,0,0,1-3.54-10H741a8.94,8.94,0,0,0,3.72,6.48,13.49,13.49,0,0,0,8.48,2.6c3.54,0,6.31-.68,8.25-2a6.17,6.17,0,0,0,2.93-5.25,5.41,5.41,0,0,0-3.27-5.1A61,61,0,0,0,750.71,56a99.89,99.89,0,0,1-11.19-3.61A19.62,19.62,0,0,1,732,47c-2.09-2.4-3.15-5.62-3.15-9.64a15.12,15.12,0,0,1,2.88-8.92A19.13,19.13,0,0,1,740,22.06a30.92,30.92,0,0,1,12.35-2.32q10.39,0,16.78,5.26T776,39.34H763.35A9,9,0,0,0,760,32.81c-2-1.63-4.7-2.44-8.12-2.44s-5.87.63-7.64,1.89a5.82,5.82,0,0,0-2.7,5,5.42,5.42,0,0,0,1.8,4.1,12.68,12.68,0,0,0,4.33,2.6c1.7.6,4.21,1.4,7.53,2.38a83.46,83.46,0,0,1,10.91,3.61,20.25,20.25,0,0,1,7.37,5.41,14.28,14.28,0,0,1,3.21,9.42,15.73,15.73,0,0,1-2.88,9.3,19.07,19.07,0,0,1-8.11,6.43,30.27,30.27,0,0,1-12.36,2.33A30.83,30.83,0,0,1,740.46,80.11Z" />
        <path d="M591.67,34.65a28.3,28.3,0,0,0-11.18-11.08,34.25,34.25,0,0,0-31.69,0,31.1,31.1,0,0,0-2.7,1.67V.75H533.47v82H546.1V77.32c.74.52,1.52,1,2.32,1.48A31.26,31.26,0,0,0,564,82.73a33.12,33.12,0,0,0,16-3.93,29.13,29.13,0,0,0,11.46-11.13,32.16,32.16,0,0,0,4.21-16.51A32.73,32.73,0,0,0,591.67,34.65ZM580.16,62.49a17.82,17.82,0,0,1-6.93,7,18.85,18.85,0,0,1-9.14,2.33,16.62,16.62,0,0,1-12.68-5.41q-5.05-5.41-5-15.23A23.76,23.76,0,0,1,548.8,40,16.56,16.56,0,0,1,555.39,33a18.15,18.15,0,0,1,9-2.32A18.52,18.52,0,0,1,573.5,33,17.23,17.23,0,0,1,580.27,40a23,23,0,0,1,2.55,11.24A22.56,22.56,0,0,1,580.16,62.49Z" />
        <circle cx="651.69" cy="7.75" r="6.82" />
        <path d="M621.78,66.36V.81H609.15V70.1a12.71,12.71,0,0,0,12.71,12.71h9.46V70.2h-5.7A3.84,3.84,0,0,1,621.78,66.36Z" />
        <path d="M167.28,34.48a27.05,27.05,0,0,1,10.58-11,30.48,30.48,0,0,1,15.51-3.88q11.07,0,18.33,5.26a25.75,25.75,0,0,1,9.81,15H207.88a14.41,14.41,0,0,0-5.32-7.09,15.6,15.6,0,0,0-9.19-2.55A15.25,15.25,0,0,0,181,35.7q-4.59,5.47-4.6,15.33T181,66.42A15.24,15.24,0,0,0,193.37,72q11,0,14.51-9.63h13.63a27.34,27.34,0,0,1-10,14.79q-7.34,5.48-18.16,5.48a30.38,30.38,0,0,1-15.51-3.93,27.59,27.59,0,0,1-10.58-11.08,34.54,34.54,0,0,1-3.82-16.56A34.55,34.55,0,0,1,167.28,34.48Z" />
        <path d="M384.5,80a22.5,22.5,0,0,1-9-7.08,17.66,17.66,0,0,1-3.54-10H385a8.9,8.9,0,0,0,3.71,6.48A13.49,13.49,0,0,0,397.2,72c3.54,0,6.31-.68,8.25-2a6.17,6.17,0,0,0,2.93-5.26,5.4,5.4,0,0,0-3.27-5.09,61.6,61.6,0,0,0-10.36-3.66,99.89,99.89,0,0,1-11.19-3.61,19.62,19.62,0,0,1-7.48-5.41q-3.16-3.6-3.16-9.64a15,15,0,0,1,2.89-8.92A19.18,19.18,0,0,1,384.06,22a30.92,30.92,0,0,1,12.35-2.32q10.41,0,16.79,5.25T420,39.25H407.38a9,9,0,0,0-3.33-6.54,12.49,12.49,0,0,0-8.11-2.43q-5.13,0-7.65,1.88a5.85,5.85,0,0,0-2.61,4.93,5.38,5.38,0,0,0,1.81,4.09,12.57,12.57,0,0,0,4.32,2.61c1.69.63,4.21,1.42,7.53,2.38a82.47,82.47,0,0,1,10.91,3.61,20.3,20.3,0,0,1,7.36,5.41,14.22,14.22,0,0,1,3.22,9.41A15.88,15.88,0,0,1,418,73.91a19.11,19.11,0,0,1-8.12,6.43,30.37,30.37,0,0,1-12.42,2.28A30.82,30.82,0,0,1,384.5,80Z" />
        <path d="M488.27,55.81H441.63A16.82,16.82,0,0,0,459,72q10.19,0,14.43-8.53h13.6a27.6,27.6,0,0,1-10,13.8q-7.22,5.4-18,5.41a31.26,31.26,0,0,1-15.68-3.94,27.92,27.92,0,0,1-10.82-11.08,33.72,33.72,0,0,1-3.93-16.56,34.76,34.76,0,0,1,3.81-16.56,26.89,26.89,0,0,1,10.75-11A32,32,0,0,1,459,19.63a31.1,31.1,0,0,1,15.4,3.76A26.7,26.7,0,0,1,485,33.93a31.94,31.94,0,0,1,3.76,15.68A39,39,0,0,1,488.27,55.81ZM475.53,45.62a14.39,14.39,0,0,0-5-11.19,17.85,17.85,0,0,0-12.09-4.21,16.22,16.22,0,0,0-11.18,4.15,17.44,17.44,0,0,0-5.55,11.25Z" />
        <path d="M359.85,51.05V19.79H347.06V25a28.5,28.5,0,0,0-2.54-1.53,34.25,34.25,0,0,0-31.69,0,28.37,28.37,0,0,0-11.19,11.07,32.83,32.83,0,0,0-4.09,16.51,33.42,33.42,0,0,0,4,16.56,28.3,28.3,0,0,0,11,11.08,31.38,31.38,0,0,0,15.62,3.94,31.81,31.81,0,0,0,18.94-5.76v5.85H359.8V51.46C359.8,51.32,359.85,51.18,359.85,51.05Zm-15.66,11.3a17.83,17.83,0,0,1-6.88,7,18.73,18.73,0,0,1-9.14,2.32,16.62,16.62,0,0,1-12.68-5.41q-5.06-5.4-5.05-15.23a23.77,23.77,0,0,1,2.44-11.24,16.56,16.56,0,0,1,6.59-6.93,18.13,18.13,0,0,1,9-2.33,18.64,18.64,0,0,1,9.09,2.33,17.18,17.18,0,0,1,6.75,6.93A22.88,22.88,0,0,1,346.89,51,22.54,22.54,0,0,1,344.19,62.35Z" />
        <path d="M280.33,28a24.27,24.27,0,0,0-10.69-6.62,32.75,32.75,0,0,0-9.83-1.42,29.59,29.59,0,0,0-15.15,3.73V.75H232v82h12.63V48.62q0-8.22,4.16-12.63t11.23-4.37q7.09,0,11.19,4.37t4.11,12.63V82.73h12.51V51Q287.85,36,280.33,28Z" />
      </g>
    </svg>
  );
};
