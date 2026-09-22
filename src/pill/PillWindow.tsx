import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/bindings";
import { Pill } from "@/tolkovo/components/Pill";
import "@/tolkovo/tolkovo.css";
import "./pill.css";

type PillState = "idle" | "recording" | "draining";

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * The floating pill window. Fills with burgundy while recording (~0.5 s),
 * drains after. Drag to move (position is remembered by the backend),
 * click to start/stop recording.
 */
const PillWindow = () => {
  const [state, setState] = useState<PillState>("idle");
  const press = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    commands
      .tolkovoPillState()
      .then((s) => setState(s as PillState))
      .catch(() => {});
    const unlisten = listen<PillState>("tk-pill-state", (e) =>
      setState(e.payload),
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    press.current = { x: e.screenX, y: e.screenY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const start = press.current;
    if (!start) return;
    if (
      Math.abs(e.screenX - start.x) > DRAG_THRESHOLD ||
      Math.abs(e.screenY - start.y) > DRAG_THRESHOLD
    ) {
      press.current = null;
      getCurrentWindow()
        .startDragging()
        .catch(() => {});
    }
  };

  const onMouseUp = () => {
    if (!press.current) return;
    press.current = null;
    commands.tolkovoPillClick().catch(() => {});
  };

  const recording = state === "recording";

  return (
    <div className="tk-pill-stage">
      <div
        className="tk-pill-hit"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => (press.current = null)}
      >
        <Pill
          width={64}
          height={140}
          fill={recording ? 100 : 0}
          transitionMs={recording ? 500 : 650}
          className="tk-pill-live"
        />
      </div>
    </div>
  );
};

export default PillWindow;
