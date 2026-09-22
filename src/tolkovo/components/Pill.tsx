import type { CSSProperties } from "react";
import { MicIcon } from "./icons";

interface PillProps {
  width: number;
  height: number;
  /** Liquid level, 0–100. */
  fill: number;
  /** How long the liquid takes to reach a new level. */
  transitionMs?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The Tolkovo pill: a vertical glass capsule with a white microphone at the
 * bottom, filled with burgundy liquid from below. No highlights, no level
 * meter, no wave — just the liquid.
 */
export const Pill = ({
  width,
  height,
  fill,
  transitionMs = 500,
  className = "",
  style,
}: PillProps) => {
  // Mic size and bottom offset scale with the pill (64×140 → 23px, 15px).
  const micSize = Math.round(width * 0.36);
  const micBottom = Math.round(height * 0.107);
  return (
    <div
      className={`tk-pill ${className}`}
      style={{ width, height, borderRadius: width / 2, ...style }}
    >
      <div
        className="tk-pill-liquid"
        style={{
          height: `${Math.max(0, Math.min(100, fill))}%`,
          transition: `height ${transitionMs}ms ease-in-out`,
        }}
      />
      <div className="tk-pill-mic" style={{ bottom: micBottom }}>
        <MicIcon size={micSize} />
      </div>
    </div>
  );
};
