import { forwardRef, type CSSProperties } from "react";
import { MicIcon } from "./icons";
import { Gel, type GelHandle } from "./Gel";

interface PillProps {
  width: number;
  height: number;
  /** How much of the capsule the gel fills, 0–100. */
  fill: number;
  /** Seconds the gel takes to settle at a new size. */
  settle?: number;
  /** Voice level 0–1: the surface reacts to speech. */
  level?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The Tolkovo pill: a vertical glass capsule with a white microphone at the
 * bottom and burgundy gel inside (see Gel). The ref reaches the gel, so a
 * dragged pill can make it lag behind.
 */
export const Pill = forwardRef<GelHandle, PillProps>(
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
        <Gel
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
