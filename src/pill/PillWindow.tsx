import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import { Pill } from "@/tolkovo/components/Pill";
import type { GelHandle } from "@/tolkovo/components/Gel";
import "@/tolkovo/tolkovo.css";
import "./pill.css";

type PillState = "idle" | "recording" | "draining";
type Anim = "enter" | "leave" | "gone" | null;

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 3;
/** How far up the gel grows while recording. */
const RECORDING_FILL = 76;

/**
 * The floating pill window. Fills with burgundy water while recording,
 * reacts to the voice, drains after. Melts into a blob when it hides and
 * gathers back from one when it shows — including on every Space switch,
 * where it is reborn on the new desktop. Drag to move
 * (the water sloshes behind), click to start/stop recording.
 */
const PillWindow = () => {
  const [state, setState] = useState<PillState>("idle");
  const [level, setLevel] = useState(0);
  const [anim, setAnim] = useState<Anim>(null);
  // On macOS 26+ the capsule is Apple's own Liquid Glass (a native view under
  // this webview); the CSS imitation of glass is then switched off.
  const [nativeGlass, setNativeGlass] = useState(false);
  const water = useRef<GelHandle | null>(null);
  const smooth = useRef(0);
  const drag = useRef<{
    x: number;
    y: number;
    lastX: number;
    lastY: number;
    moving: boolean;
    pending: { x: number; y: number } | null;
    raf: number;
  } | null>(null);

  useEffect(() => {
    commands
      .tolkovoPillNativeGlass()
      .then(setNativeGlass)
      .catch(() => {});
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
          v > smooth.current ? v : smooth.current * 0.82 + v * 0.18;
        setLevel(smooth.current);
      }),
      listen<boolean>("tk-pill-visible", (e) => {
        if (!e.payload) {
          setAnim("leave");
          return;
        }
        // Start the entrance only once the (re)shown window has painted, so
        // its first frames are not lost while the panel is being ordered in.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setAnim("enter")),
        );
      }),
      // A Space switch: go invisible before the panel is moved to the new
      // Space, then "tk-pill-visible" gathers it back from a blob.
      listen("tk-pill-prep", () => setAnim("gone")),
    ];
    return () => {
      subs.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      x: e.screenX,
      y: e.screenY,
      lastX: e.screenX,
      lastY: e.screenY,
      moving: false,
      pending: null,
      raf: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moving) {
      if (
        Math.abs(e.screenX - d.x) <= DRAG_THRESHOLD &&
        Math.abs(e.screenY - d.y) <= DRAG_THRESHOLD
      )
        return;
      d.moving = true;
      commands.tolkovoPillDrag("start", d.x, d.y).catch(() => {});
    }
    // The water lags behind the glass.
    water.current?.nudge(e.screenX - d.lastX, e.screenY - d.lastY);
    d.lastX = e.screenX;
    d.lastY = e.screenY;
    // One window move per frame is plenty.
    d.pending = { x: e.screenX, y: e.screenY };
    if (!d.raf) {
      d.raf = requestAnimationFrame(() => {
        d.raf = 0;
        if (d.pending) {
          commands
            .tolkovoPillDrag("move", d.pending.x, d.pending.y)
            .catch(() => {});
          d.pending = null;
        }
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (d.moving) {
      if (d.pending)
        commands
          .tolkovoPillDrag("move", d.pending.x, d.pending.y)
          .catch(() => {});
      return;
    }
    commands.tolkovoPillClick().catch(() => {});
  };

  const recording = state === "recording";

  return (
    <div className="tk-pill-stage">
      <div
        className="tk-pill-hit"
        data-anim={anim ?? undefined}
        data-native={nativeGlass ? "" : undefined}
        onAnimationEnd={() => anim === "enter" && setAnim(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
      >
        <Pill
          ref={water}
          width={32}
          height={70}
          fill={recording ? RECORDING_FILL : 0}
          level={recording ? level : 0}
          settle={recording ? 0.5 : 0.7}
          className={`tk-pill-live${nativeGlass ? " tk-pill-native" : ""}`}
        />
      </div>
    </div>
  );
};

export default PillWindow;
