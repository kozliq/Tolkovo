import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export interface LiquidHandle {
  /** Push the water sideways, e.g. when the pill is dragged (px of motion). */
  nudge: (dx: number, dy: number) => void;
}

interface LiquidProps {
  width: number;
  height: number;
  /** Target level, 0–100. */
  fill: number;
  /** Voice level 0–1. */
  level: number;
  /** Seconds the level takes to settle; shorter = snappier. */
  settle?: number;
}

// Surface: a chain of damped springs (a 1-D wave equation). Enough columns
// for a smooth curve at 64 px, few enough to be cheap.
// Tuned offline (see the physics harness in the PR notes): swells up to
// ~5 px, a smooth surface, and calm again ~3 s after you stop talking.
const COLUMNS = 12;
const TENSION = 0.004; // pull back to rest (low = slow, heavy swell)
const DAMPING = 0.02; // energy loss per step
const SPREAD = 0.25; // how much each column drags its neighbours
const SPREAD_PASSES = 4; // more passes = smoother, rounder surface
const VOICE_EVERY = 0.16; // s between voice swells
const STEP = 1 / 120; // fixed physics step (s)

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Burgundy water drawn on a canvas and moved by a tiny physics simulation:
 * a smooth spring-chain surface with a meniscus at the glass, a slow sloshing
 * tilt with inertia (drag the pill and the water lags behind) and broad
 * swells from the voice. The loop sleeps when the water is still.
 */
export const Liquid = forwardRef<LiquidHandle, LiquidProps>(
  ({ width, height, fill, level, settle = 0.5 }, ref) => {
    const canvas = useRef<HTMLCanvasElement | null>(null);
    const sim = useRef({
      h: new Float32Array(COLUMNS),
      v: new Float32Array(COLUMNS),
      tilt: 0, // surface slope (px across the width)
      tiltV: 0,
      lvl: fill, // current level (%)
      lvlV: 0,
      target: fill,
      voice: 0,
      voiceClock: 0,
      raf: 0,
      last: 0,
      acc: 0,
    });
    const settleRef = useRef(settle);
    settleRef.current = settle;

    const wake = useRef<() => void>(() => {});

    useImperativeHandle(ref, () => ({
      nudge: (dx, dy) => {
        const s = sim.current;
        // Water lags behind the glass: moving right tilts it up on the left.
        s.tiltV += Math.max(-40, Math.min(40, -dx * 0.6));
        // A vertical jolt bounces the whole surface.
        const kick = Math.max(-3, Math.min(3, dy * 0.06));
        for (let i = 0; i < COLUMNS; i++) s.v[i] += kick;
        wake.current();
      },
    }));

    useEffect(() => {
      sim.current.target = fill;
      wake.current();
    }, [fill]);

    useEffect(() => {
      sim.current.voice = level;
      if (level > 0.02) wake.current();
    }, [level]);

    useEffect(() => {
      const el = canvas.current;
      if (!el) return;
      const ctx = el.getContext("2d");
      if (!ctx) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      el.width = Math.round(width * dpr);
      el.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = sim.current;
      const still = reducedMotion();

      const physics = () => {
        // Level: a lightly under-damped spring, so it overshoots a touch.
        const w = (2 * Math.PI) / Math.max(0.15, settleRef.current * 1.6);
        const zeta = 0.72;
        // The water breathes with the voice: louder speech lifts it a little,
        // pauses let it sink back — the clearest sign you are being heard.
        const lift = s.target > 0 ? Math.min(1, s.voice * 1.8) * 9 : 0;
        const goal = Math.min(97, s.target + lift);
        const a = w * w * (goal - s.lvl) - 2 * zeta * w * s.lvlV;
        s.lvlV += a * STEP;
        s.lvl += s.lvlV * STEP;
        if (still) {
          s.lvl = s.target;
          s.lvlV = 0;
        }

        // Rising water leans a touch, then settles.
        s.tiltV += s.lvlV * 0.02;

        // Tilt: a slow, heavy pendulum.
        s.tiltV += (-9 * s.tilt - 1.9 * s.tiltV) * STEP;
        s.tilt += s.tiltV * STEP;

        // Voice: a few broad swells per second, never needle-like spikes.
        s.voiceClock += STEP;
        if (s.voice > 0.02 && !still && s.voiceClock >= VOICE_EVERY) {
          s.voiceClock = 0;
          const c = Math.random() * (COLUMNS - 1);
          const amp = (Math.random() * 0.6 + 0.4) * s.voice * 1.2;
          const dir = Math.random() < 0.5 ? -1 : 1;
          for (let i = 0; i < COLUMNS; i++) {
            const d = (i - c) / 3.2;
            s.v[i] += dir * amp * Math.exp(-d * d);
          }
          s.tiltV += dir * s.voice * 3;
        }

        // Spring chain.
        for (let i = 0; i < COLUMNS; i++) {
          s.v[i] += -TENSION * s.h[i] - DAMPING * s.v[i];
        }
        for (let pass = 0; pass < SPREAD_PASSES; pass++) {
          for (let i = 0; i < COLUMNS; i++) {
            if (i > 0) s.v[i - 1] += SPREAD * (s.h[i] - s.h[i - 1]) * 0.5;
            if (i < COLUMNS - 1)
              s.v[i + 1] += SPREAD * (s.h[i] - s.h[i + 1]) * 0.5;
          }
        }
        for (let i = 0; i < COLUMNS; i++) s.h[i] += s.v[i];
      };

      const draw = () => {
        ctx.clearRect(0, 0, width, height);
        const base = height * (1 - s.lvl / 100);
        if (s.lvl <= 0.05 && s.lvlV <= 0) return;

        // Surface points: spring displacement + tilt + meniscus at the walls.
        const pts: [number, number][] = [];
        for (let i = 0; i < COLUMNS; i++) {
          const x = (i / (COLUMNS - 1)) * width;
          const t = x / width - 0.5;
          const edge = Math.min(x, width - x);
          const meniscus = -2.2 * Math.exp(-edge / 2.6);
          pts.push([x, base + s.h[i] + s.tilt * t + meniscus]);
        }

        const surface = () => {
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2;
            const my = (pts[i][1] + pts[i + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
          }
          const last = pts[pts.length - 1];
          ctx.lineTo(last[0], last[1]);
        };

        // Body: deep burgundy, darker with depth.
        ctx.beginPath();
        surface();
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const top = Math.min(...pts.map((p) => p[1]));
        const body = ctx.createLinearGradient(0, top, 0, height);
        body.addColorStop(0, "#c0344f");
        body.addColorStop(0.35, "#9a2440");
        body.addColorStop(1, "#56112a");
        ctx.fillStyle = body;
        ctx.fill();

        ctx.save();
        ctx.clip();
        // Volume: the cylinder darkens toward the glass.
        const side = ctx.createLinearGradient(0, 0, width, 0);
        side.addColorStop(0, "rgba(20,0,8,0.32)");
        side.addColorStop(0.28, "rgba(20,0,8,0)");
        side.addColorStop(0.72, "rgba(20,0,8,0)");
        side.addColorStop(1, "rgba(20,0,8,0.32)");
        ctx.fillStyle = side;
        ctx.fillRect(0, 0, width, height);
        // Light passing through just under the surface.
        const sheen = ctx.createLinearGradient(0, top, 0, top + 14);
        sheen.addColorStop(0, "rgba(255,170,190,0.28)");
        sheen.addColorStop(1, "rgba(255,170,190,0)");
        ctx.fillStyle = sheen;
        ctx.fillRect(0, top - 2, width, 18);
        ctx.restore();

        // The meniscus line: a thin, bright edge where water meets air.
        ctx.beginPath();
        surface();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,200,212,0.55)";
        ctx.stroke();
      };

      const calm = () => {
        let e = Math.abs(s.tilt) + Math.abs(s.tiltV) + Math.abs(s.lvlV);
        e += Math.abs(s.target - s.lvl) * (s.voice > 0.02 ? 0 : 1);
        for (let i = 0; i < COLUMNS; i++)
          e += Math.abs(s.h[i]) + Math.abs(s.v[i]);
        return e < 0.05 && s.voice <= 0.02;
      };

      const frame = (now: number) => {
        const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : STEP;
        s.last = now;
        s.acc += dt;
        while (s.acc >= STEP) {
          physics();
          s.acc -= STEP;
        }
        draw();
        if (calm()) {
          s.raf = 0;
          s.last = 0;
          return;
        }
        s.raf = requestAnimationFrame(frame);
      };

      wake.current = () => {
        if (!s.raf) s.raf = requestAnimationFrame(frame);
      };
      wake.current();
      return () => {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        wake.current = () => {};
      };
    }, [width, height]);

    return (
      <canvas
        ref={canvas}
        className="tk-liquid"
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  },
);

Liquid.displayName = "Liquid";
