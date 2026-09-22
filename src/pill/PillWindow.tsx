import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { commands } from "@/bindings";
import { Pill } from "@/tolkovo/components/Pill";
import "@/tolkovo/tolkovo.css";
import "./pill.css";

type PillState = "idle" | "recording" | "draining";
type Anim = "enter" | "leave" | null;

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 4;
/**
 * Liquid level while recording. Not quite to the brim, so the water
 * surface — which ripples with the voice — stays in view.
 */
const RECORDING_FILL = 74;

/**
 * The floating pill window. Fills with burgundy water while recording,
 * ripples with the voice, drains after. Melts into a blob when it hides and
 * gathers back when it shows. Drag to move (the backend remembers where),
 * click to start/stop recording.
 */
const PillWindow = () => {
  const [state, setState] = useState<PillState>("idle");
  const [level, setLevel] = useState(0);
  const [anim, setAnim] = useState<Anim>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const smooth = useRef(0);

  useEffect(() => {
    commands
      .tolkovoPillState()
      .then((s) => setState(s as PillState))
      .catch(() => {});
    const subs = [
      listen<PillState>("tk-pill-state", (e) => {
        setState(e.payload);
        if (e.payload !== "recording") {
          smooth.current = 0;
          setLevel(0);
        }
      }),
      listen<number>("tk-pill-level", (e) => {
        // Fast attack, slow release — reads as water reacting to a voice.
        const v = e.payload;
        smooth.current =
          v > smooth.current ? v : smooth.current * 0.8 + v * 0.2;
        setLevel(smooth.current);
      }),
      listen<boolean>("tk-pill-visible", (e) =>
        setAnim(e.payload ? "enter" : "leave"),
      ),
    ];
    return () => {
      subs.forEach((p) => p.then((fn) => fn()));
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
        data-anim={anim ?? undefined}
        onAnimationEnd={() => anim === "enter" && setAnim(null)}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => (press.current = null)}
      >
        <Pill
          width={64}
          height={140}
          fill={recording ? RECORDING_FILL : 0}
          level={recording ? level : 0}
          transitionMs={recording ? 500 : 650}
          className="tk-pill-live"
        />
      </div>
    </div>
  );
};

export default PillWindow;
