import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import { Pill } from "@/tolkovo/components/Pill";
import "@/tolkovo/tolkovo.css";
import "./pill.css";

type PillState = "idle" | "recording" | "draining";
type Anim = "enter" | "leave" | "gone" | null;

/** Pixels the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 3;
/** While recording the capsule is full of burgundy glass. */
const RECORDING_FILL = 100;

/**
 * The floating pill window. Fills with burgundy glass while recording and
 * drains after. Switches on and off like an old TV, including on every Space
 * switch, where it is reborn on the new desktop. Drag to move (the backend
 * remembers where), click to start/stop recording.
 */
const PillWindow = () => {
  const [state, setState] = useState<PillState>("idle");
  const [anim, setAnim] = useState<Anim>(null);
  // On macOS 26+ the capsule is Apple's own Liquid Glass (a native view under
  // this webview); the CSS imitation of glass is then switched off.
  const [nativeGlass, setNativeGlass] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
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
      listen<PillState>("tk-pill-state", (e) => setState(e.payload)),
      listen<boolean>("tk-pill-visible", (e) => {
        if (!e.payload) {
          setAnim("leave");
          return;
        }
        // The collapse/expand itself is native and already running; start
        // the flash right away so it lines up with the dot and the line.
        setAnim("enter");
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
      commands.tolkovoPillDrag("end", 0, 0).catch(() => {});
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
          width={32}
          height={70}
          fill={recording ? RECORDING_FILL : 0}
          transitionMs={recording ? 450 : 420}
          className={`tk-pill-live${nativeGlass ? " tk-pill-native" : ""}`}
        />
      </div>
    </div>
  );
};

export default PillWindow;
