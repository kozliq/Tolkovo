import { forwardRef, type CSSProperties } from "react";
import { MicIcon } from "./icons";
import { Liquid, type LiquidHandle } from "./Liquid";

interface PillProps {
  width: number;
  height: number;
  /** Liquid level, 0–100. */
  fill: number;
  /** Seconds the liquid takes to settle at a new level. */
  settle?: number;
  /** Voice level 0–1: the surface reacts to speech. */
  level?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The Tolkovo pill: a vertical glass capsule with a white microphone at the
 * bottom and burgundy water inside (see Liquid). The ref reaches the water,
 * so a dragged pill can make it slosh.
 */
export const Pill = forwardRef<LiquidHandle, PillProps>(
  (
    { width, height, fill, settle = 0.5, level = 0, className = "", style },
    ref,
  ) => {
    // Mic size and bottom offset scale with the pill (64×140 → 23px, 15px).
    const micSize = Math.round(width * 0.36);
    const micBottom = Math.round(height * 0.107);
    return (
      <div
        className={`tk-pill ${className}`}
        style={{ width, height, borderRadius: width / 2, ...style }}
      >
        <Liquid
          ref={ref}
          width={width}
          height={height}
          fill={fill}
          level={level}
          settle={settle}
        />
        <div className="tk-pill-mic" style={{ bottom: micBottom }}>
          <MicIcon size={micSize} />
        </div>
      </div>
    );
  },
);

Pill.displayName = "Pill";
