import type { CSSProperties } from "react";
import { MicIcon } from "./icons";

interface PillProps {
  width: number;
  height: number;
  /** Liquid level, 0–100. */
  fill: number;
  /** How long the liquid takes to reach a new level. */
  transitionMs?: number;
  /** Voice level 0–1: how hard the surface ripples. */
  level?: number;
  className?: string;
  style?: CSSProperties;
}

// One wavelength per 50 units; the strip is two pill-widths wide and slides
// by exactly half its width, so the loop is seamless.
const WAVE =
  "M0 10 Q12.5 3 25 10 T50 10 T75 10 T100 10 T125 10 T150 10 T175 10 T200 10 V24 H0 Z";

const Wave = ({ className }: { className: string }) => (
  <svg
    className={`tk-wave ${className}`}
    viewBox="0 0 200 24"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path d={WAVE} />
  </svg>
);

/**
 * The Tolkovo pill: a vertical glass capsule with a white microphone at the
 * bottom, filled with burgundy liquid from below. The liquid behaves like
 * water in a toy: the surface rolls in two layers, gently sloshes, and
 * ripples harder with the voice level while recording.
 */
export const Pill = ({
  width,
  height,
  fill,
  transitionMs = 500,
  level = 0,
  className = "",
  style,
}: PillProps) => {
  // Mic size and bottom offset scale with the pill (64×140 → 23px, 15px).
  const micSize = Math.round(width * 0.36);
  const micBottom = Math.round(height * 0.107);
  const clamped = Math.max(0, Math.min(100, fill));
  // Resting ripple, growing with the voice.
  const amp = 0.6 + Math.min(1, level * 2.4) * 1.4;
  return (
    <div
      className={`tk-pill ${className}`}
      style={{ width, height, borderRadius: width / 2, ...style }}
    >
      <div
        className="tk-pill-liquid"
        data-empty={clamped < 1 ? "" : undefined}
        style={
          {
            height: `${clamped}%`,
            transition: `height ${transitionMs}ms cubic-bezier(0.45, 0, 0.25, 1)`,
            "--tk-amp": amp,
            "--tk-wave-h": `${Math.max(10, Math.round(width * 0.28))}px`,
          } as CSSProperties
        }
      >
        <div className="tk-slosh">
          <Wave className="tk-wave-back" />
          <Wave className="tk-wave-front" />
          <div className="tk-pill-body" />
        </div>
      </div>
      <div className="tk-pill-mic" style={{ bottom: micBottom }}>
        <MicIcon size={micSize} />
      </div>
    </div>
  );
};
