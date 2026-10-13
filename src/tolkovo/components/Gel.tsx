import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
} from "react";

export interface GelHandle {
  /** Push the gel sideways, e.g. when the pill is dragged (px of motion). */
  nudge: (dx: number, dy: number) => void;
}

interface GelProps {
  width: number;
  height: number;
  /** How much of the capsule the gel fills, 0–100. */
  fill: number;
  /** Voice level 0–1. */
  level: number;
  /** Seconds the gel takes to settle at a new size. */
  settle?: number;
}

// Everything is computed in one fixed coordinate space — the on-screen pill
// (32×70) — and the SVG scales it to whatever size the pill is drawn at, so
// the gooey filter behaves the same on the 76×168 download screen.
const VW = 32;
const VH = 70;
/** Where the gel gathers when empty: right on the microphone. */
const HOME_Y = VH - 9;
const BLOBS = 5;

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Burgundy gel in a lava lamp. A few soft balls are merged into one glossy
 * drop by an SVG "goo" filter (blur + alpha threshold), lit by a specular
 * filter for the gel shine. It grows up from the microphone when recording
 * starts, swells and flows with the voice, lags behind when the pill is
 * dragged, and drains back into the microphone afterwards. The animation
 * loop sleeps while the pill is empty.
 */
export const Gel = forwardRef<GelHandle, GelProps>(
  ({ width, height, fill, level, settle = 0.45 }, ref) => {
    const id = useId().replace(/:/g, "");
    const circles = useRef<(SVGCircleElement | null)[]>([]);
    const sim = useRef({
      lvl: fill / 100,
      lvlV: 0,
      target: fill / 100,
      voice: 0,
      voiceSmooth: 0,
      shiftX: 0,
      shiftV: 0,
      t: Math.random() * 100,
      raf: 0,
      last: 0,
    });
    const settleRef = useRef(settle);
    settleRef.current = settle;
    const wake = useRef<() => void>(() => {});

    useImperativeHandle(ref, () => ({
      nudge: (dx) => {
        const s = sim.current;
        // The gel lags behind the glass, then springs back.
        s.shiftV += Math.max(-60, Math.min(60, -dx * 2.2));
        wake.current();
      },
    }));

    useEffect(() => {
      sim.current.target = fill / 100;
      wake.current();
    }, [fill]);

    useEffect(() => {
      sim.current.voice = level;
      if (level > 0.02) wake.current();
    }, [level]);

    useEffect(() => {
      const s = sim.current;
      const still = reducedMotion();
      // Fixed per-blob character: phase and speed of its lava-lamp drift.
      const seeds = Array.from({ length: BLOBS }, (_, i) => ({
        phase: i * 1.7 + 0.4,
        speed: 0.55 + ((i * 37) % 10) / 22,
        size: 0.78 + ((i * 53) % 10) / 40,
      }));

      const step = (dt: number) => {
        // Size: a lightly under-damped spring, so it overshoots a touch.
        const w = (2 * Math.PI) / Math.max(0.15, settleRef.current * 1.6);
        const zeta = 0.7;
        const a = w * w * (s.target - s.lvl) - 2 * zeta * w * s.lvlV;
        s.lvlV += a * dt;
        s.lvl += s.lvlV * dt;
        if (still) {
          s.lvl = s.target;
          s.lvlV = 0;
        }
        // Voice: fast attack, slow release.
        s.voiceSmooth +=
          (s.voice - s.voiceSmooth) * (s.voice > s.voiceSmooth ? 0.35 : 0.06);
        // Drag inertia: a spring pulling the gel back to the middle.
        s.shiftV += (-60 * s.shiftX - 9 * s.shiftV) * dt;
        s.shiftX += s.shiftV * dt;
        // Time runs faster while you speak: the gel flows more.
        if (!still) s.t += dt * (0.6 + s.voiceSmooth * 2.4);
      };

      const draw = () => {
        const L = Math.max(0, s.lvl);
        const v = s.voiceSmooth;
        const span = (VH - 18) * L; // how far up the gel reaches
        const drift = still ? 0 : 1;
        for (let i = 0; i < BLOBS; i++) {
          const c = circles.current[i];
          if (!c) continue;
          const seed = seeds[i];
          const f = i / (BLOBS - 1);
          const x =
            VW / 2 +
            s.shiftX * (0.6 + f * 0.8) +
            drift *
              Math.sin(s.t * seed.speed + seed.phase) *
              VW *
              (0.09 + v * 0.08);
          const y =
            HOME_Y -
            span * f +
            drift * Math.cos(s.t * seed.speed * 0.8 + seed.phase) * (2 + v * 4);
          const r =
            L <= 0.001
              ? 0
              : Math.min(1, L * 2.5) *
                VW *
                0.36 *
                seed.size *
                (1 +
                  v * 0.35 +
                  Math.sin(s.t * 1.3 + seed.phase) * 0.06 * drift);
          c.setAttribute("cx", x.toFixed(2));
          c.setAttribute("cy", y.toFixed(2));
          c.setAttribute("r", Math.max(0, r).toFixed(2));
        }
      };

      const calm = () =>
        s.target <= 0.001 &&
        s.lvl <= 0.002 &&
        Math.abs(s.lvlV) < 0.002 &&
        Math.abs(s.shiftX) < 0.05 &&
        Math.abs(s.shiftV) < 0.05;

      const frame = (now: number) => {
        const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 1 / 60;
        s.last = now;
        step(dt);
        draw();
        // While there is gel, the lava lamp keeps flowing; an empty pill
        // stops the loop entirely.
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
      draw();
      wake.current();
      return () => {
        cancelAnimationFrame(s.raf);
        s.raf = 0;
        wake.current = () => {};
      };
    }, []);

    return (
      <svg
        className="tk-gel"
        width={width}
        height={height}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <filter
            id={`goo-${id}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            {/* Merge the balls into one drop. */}
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="2.4"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            {/* Gel shine: light the drop's own shape from the top left. */}
            <feGaussianBlur in="goo" stdDeviation="1.6" result="soft" />
            <feSpecularLighting
              in="soft"
              surfaceScale="4"
              specularConstant="0.95"
              specularExponent="26"
              lightingColor="#ffd3dc"
              result="spec"
            >
              <fePointLight x="6" y="-14" z="34" />
            </feSpecularLighting>
            <feComposite in="spec" in2="goo" operator="in" result="shine" />
            <feComposite
              in="goo"
              in2="shine"
              operator="arithmetic"
              k1="0"
              k2="1"
              k3="0.85"
              k4="0"
            />
          </filter>
          <radialGradient id={`body-${id}`} cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#c23a52" />
            <stop offset="60%" stopColor="#8e2138" />
            <stop offset="100%" stopColor="#5b1426" />
          </radialGradient>
        </defs>
        <g filter={`url(#goo-${id})`} fill={`url(#body-${id})`}>
          {Array.from({ length: BLOBS }, (_, i) => (
            <circle
              key={i}
              ref={(el) => {
                circles.current[i] = el;
              }}
              cx={VW / 2}
              cy={HOME_Y}
              r={0}
            />
          ))}
        </g>
      </svg>
    );
  },
);

Gel.displayName = "Gel";
