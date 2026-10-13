import type { CSSProperties, ReactNode } from "react";
import { MicIcon } from "./icons";

interface PillProps {
  width: number;
  height: number;
  /** How much of the capsule is filled with burgundy, 0–100. */
  fill: number;
  /** How long the fill takes to reach a new level. */
  transitionMs?: number;
  className?: string;
  style?: CSSProperties;
  /** Drawn inside the capsule, over the fill (e.g. the voice meter). */
  children?: ReactNode;
}

/**
 * The Tolkovo pill: a glass capsule with a white microphone at the bottom.
 * While recording it simply fills with burgundy glass from the bottom up;
 * afterwards it drains back down. Nothing else moves.
 */
export const Pill = ({
  width,
  height,
  fill,
  transitionMs = 450,
  className = "",
  style,
  children,
}: PillProps) => {
  // Mic size and bottom offset scale with the pill (64×140 → 23px, 15px).
  const micSize = Math.round(width * 0.36);
  const micBottom = Math.round(height * 0.107);
  const level = Math.max(0, Math.min(100, fill));
  return (
    <div
      className={`tk-pill ${className}`}
      style={{ width, height, borderRadius: width / 2, ...style }}
    >
      <div
        className="tk-pill-fill"
        data-empty={level < 0.5 ? "" : undefined}
        data-full={level > 99.5 ? "" : undefined}
        style={{
          height: `${level}%`,
          transitionDuration: `${transitionMs}ms`,
        }}
      />
      {children}
      <div className="tk-pill-mic" style={{ bottom: micBottom }}>
        <MicIcon size={micSize} />
      </div>
    </div>
  );
};
