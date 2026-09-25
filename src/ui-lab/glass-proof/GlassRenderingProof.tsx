import { useLayoutEffect, useRef, useState } from "react";
import { MaterialSurface } from "../../ui/materials/MaterialSurface";
import {
  SharedSmallGlassPlane,
  writeSharedSmallGlassShapes,
} from "../../ui/materials/SharedSmallGlassPlane";
import { Button } from "../../ui/primitives/Button";
import { useProofBackdrop } from "./useProofBackdrop";
import "./glassRenderingProof.css";

/** Reproduces the current backend. Layer labels describe intended sampling, not proven isolation. */
export function GlassRenderingProof() {
  const [majorA, setMajorA] = useState(true);
  const [ink, setInk] = useState(false);
  const [lowerInk, setLowerInk] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [promoted, setPromoted] = useState(false);
  const [moving, setMoving] = useState(false);
  const [animated, setAnimated] = useState(false);
  const plane = useRef<HTMLDivElement>(null);
  const backdrop = useProofBackdrop(moving, animated);
  useLayoutEffect(() => {
    if (plane.current)
      writeSharedSmallGlassShapes(plane.current, [
        { x: 24, y: 130, width: 210, height: 110, radius: 14 },
        ...(!promoted ? [{ x: 290, y: 130, width: 210, height: 110, radius: 14 }] : []),
      ]);
  }, [promoted]);
  const reset = () => {
    setMajorA(true);
    setInk(false);
    setLowerInk(false);
    setOverlay(false);
    setPromoted(false);
    setMoving(false);
    setAnimated(false);
    backdrop.setPosition(0);
  };
  return (
    <section className="taskmap-glass-proof" aria-label="Glass rendering proof">
      <h1>Glass rendering proof · current native backend</h1>
      <p>
        Layer labels are requirements, not isolation guarantees. Pause motion before A/B
        comparisons.
      </p>
      <div className="taskmap-glass-proof__controls">
        {(
          [
            ["Show Major A", majorA, setMajorA],
            ["Major A ink", ink, setInk],
            ["Lower card ink", lowerInk, setLowerInk],
            ["Higher overlay", overlay, setOverlay],
            ["Promote Minor", promoted, setPromoted],
            ["Move red", moving, setMoving],
            ["Animate media", animated, setAnimated],
          ] as const
        ).map(([label, checked, update]) => (
          <label key={label}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => update(event.target.checked)}
            />
            {label}
          </label>
        ))}
        <Button size="compact" onClick={reset}>
          Reset proof
        </Button>
      </div>
      <div className="taskmap-glass-proof__controls">
        <Button size="compact" disabled={moving} onClick={() => backdrop.setPosition(0)}>
          Red left
        </Button>
        <Button size="compact" disabled={moving} onClick={() => backdrop.setPosition(260)}>
          Red under glass
        </Button>
        <Button size="compact" disabled={moving} onClick={() => backdrop.setPosition(740)}>
          Red right
        </Button>
        <span>Pause Move red to drag the handle; release must not correct the blur.</span>
      </div>
      <div className="taskmap-glass-proof__viewport">
        <div className="taskmap-glass-proof__scene" data-glass-proof-scene>
          <div className="taskmap-glass-proof__workspace" data-proof-layer="0">
            <div ref={backdrop.red} className="taskmap-glass-proof__red" data-proof-red-x="0" />
            <canvas
              ref={backdrop.media}
              width="240"
              height="180"
              className="taskmap-glass-proof__media"
              aria-label="Changing checker media"
            />
            <span className="taskmap-glass-proof__workspace-label">
              L0 · grid / red object / changing canvas media
            </span>
          </div>
          <MaterialSurface
            material="acrylic-large"
            radius={20}
            className="taskmap-glass-proof__major-a"
            data-proof-surface="major-a"
            data-proof-layer="1"
            style={{ visibility: majorA ? "visible" : "hidden" }}
          >
            <h2>Persistent Major A · L1</h2>
            <div className="taskmap-glass-proof__ink" data-proof-ink={ink}>
              A content
            </div>
            <SharedSmallGlassPlane ref={plane} batchId="proof-settled-minors" />
            <MaterialSurface
              material="acrylic-small"
              backdropSource="shared"
              radius={14}
              className="taskmap-glass-proof__minor taskmap-glass-proof__minor-lower"
              data-proof-surface="minor-lower"
            >
              <strong>Lower Minor</strong>
              <div className="taskmap-glass-proof__card-ink" data-proof-ink={lowerInk}>
                TEXT · ▦ · cyan / magenta
              </div>
            </MaterialSurface>
            <MaterialSurface
              material="acrylic-small"
              backdropSource={promoted ? "self" : "shared"}
              radius={14}
              className="taskmap-glass-proof__minor taskmap-glass-proof__minor-upper"
              data-proof-surface="minor-upper"
              data-proof-promoted={promoted}
            >
              <strong>{promoted ? "Promoted Minor" : "Settled Minor"}</strong>
              <p>Same recipe and radius</p>
            </MaterialSurface>
          </MaterialSurface>
          <MaterialSurface
            material="acrylic-large"
            radius={20}
            className="taskmap-glass-proof__major-b"
            data-proof-surface="major-b"
            data-proof-layer="1"
          >
            <h2>Persistent Major B · L1</h2>
            <p>A ink must not affect this glass.</p>
          </MaterialSurface>
          {overlay && (
            <MaterialSurface
              material="acrylic-large"
              radius={20}
              className="taskmap-glass-proof__overlay"
              data-proof-surface="overlay"
              data-proof-layer="2"
            >
              <h2>Overlay Major · L2</h2>
              <p>Should sample completed lower UI.</p>
            </MaterialSurface>
          )}
          <button
            type="button"
            ref={backdrop.handle}
            disabled={moving}
            className="taskmap-glass-proof__drag"
            {...backdrop.dragEvents}
          >
            Drag red ↔
          </button>
        </div>
      </div>
      <ol>
        <li>Toggle A ink: B must stay unchanged; the higher overlay should respond.</li>
        <li>
          Promote Minor, then toggle lower-card ink: the upper card must blur completed lower
          content.
        </li>
        <li>
          Move red and animate media: glass must stay live, including while the pointer is held.
        </li>
        <li>
          Move red outside a surface: inspect ambient blur, corners and stale trails. Reset and
          repeat.
        </li>
      </ol>
    </section>
  );
}
