import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TextBlockNode } from "../components/TextBlockNode";
import type { TextBlockElement } from "../types";
import { Button } from "../ui/primitives/Button";
import { Surface } from "./system/Surface";
import "./draggableTextBlockFixture.css";

const INITIAL_POSITION = { x: 48, y: 238 } as const;

const TEXT_BLOCK: TextBlockElement = {
  id: "ui-lab-red-text-block",
  name: "Moving red production TextBlock",
  text: [
    "## Live backdrop sample",
    "Drag this real production node beneath the Major and Minor glass surfaces.",
    "",
    "- Saturated red header and rim",
    "- Multi-line ordinary content",
    "- Live movement for blur inspection",
  ].join("\n"),
  x: 0,
  y: 0,
  width: 340,
  height: 230,
  accent: "#f01846",
};

type Point = { x: number; y: number };

type ActiveDrag = {
  pointerId: number;
  startClient: Point;
  startPosition: Point;
  pendingPosition: Point;
  frame: number | null;
};

export function DraggableTextBlockFixture() {
  const nodeLayerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<Point>({ ...INITIAL_POSITION });
  const activeDragRef = useRef<ActiveDrag | null>(null);
  const [moving, setMoving] = useState(false);

  const applyPosition = (position: Point) => {
    positionRef.current = position;
    const layer = nodeLayerRef.current;
    if (!layer) return;
    layer.style.left = `${position.x}px`;
    layer.style.top = `${position.y}px`;
    layer.dataset.dragX = String(Math.round(position.x));
    layer.dataset.dragY = String(Math.round(position.y));
  };

  const flushPendingPosition = () => {
    const drag = activeDragRef.current;
    if (!drag) return;
    drag.frame = null;
    applyPosition(drag.pendingPosition);
  };

  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || activeDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDragRef.current = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startPosition: { ...positionRef.current },
      pendingPosition: { ...positionRef.current },
      frame: null,
    };
    setMoving(true);
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.pendingPosition = {
      x: drag.startPosition.x + event.clientX - drag.startClient.x,
      y: drag.startPosition.y + event.clientY - drag.startClient.y,
    };
    if (drag.frame === null) drag.frame = requestAnimationFrame(flushPendingPosition);
  };

  const finishMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    drag.pendingPosition = {
      x: drag.startPosition.x + event.clientX - drag.startClient.x,
      y: drag.startPosition.y + event.clientY - drag.startClient.y,
    };
    flushPendingPosition();
    activeDragRef.current = null;
    setMoving(false);
  };

  const cancelMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = activeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    applyPosition(drag.pendingPosition);
    activeDragRef.current = null;
    setMoving(false);
  };

  const resetPosition = () => applyPosition({ ...INITIAL_POSITION });

  return (
    <section
      className="taskmap-ui-lab-text-block"
      aria-labelledby="draggable-text-block-title"
      data-ui-lab-text-block-fixture
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Live material movement fixture</span>
        <h2 id="draggable-text-block-title">Production TextBlock beneath glass</h2>
        <p>
          Drag the red node across both glass surfaces to inspect live blur, saturation, rims, and
          shadows.
        </p>
      </div>

      <div className="taskmap-ui-lab-text-block__scene" data-ui-lab-text-block-scene>
        <div
          ref={nodeLayerRef}
          className="taskmap-ui-lab-text-block__node-layer"
          data-drag-x={INITIAL_POSITION.x}
          data-drag-y={INITIAL_POSITION.y}
          data-ui-lab-draggable-text-block
          onLostPointerCapture={cancelMove}
          onPointerCancel={cancelMove}
          onPointerMove={move}
          onPointerUp={finishMove}
          style={{
            left: INITIAL_POSITION.x,
            top: INITIAL_POSITION.y,
          }}
        >
          <TextBlockNode
            element={TEXT_BLOCK}
            selected={false}
            multiSelected={false}
            entering={false}
            deleting={false}
            pulsing={false}
            moving={moving}
            shadowsUnderElements={false}
            recentColors={[]}
            editing={false}
            draft=""
            renaming={false}
            renameDraft=""
            onDraftChange={() => undefined}
            onSave={() => undefined}
            onCancel={() => undefined}
            onRenameDraftChange={() => undefined}
            onSaveRename={() => undefined}
            onCancelRename={() => undefined}
            onStartEdit={() => undefined}
            onSelect={() => undefined}
            onStartMove={startMove}
            onStartResize={(event) => event.stopPropagation()}
            onToggleMenu={(event) => event.stopPropagation()}
            onTogglePrivacy={() => undefined}
            onToggleLock={() => undefined}
            onUpdateAccent={() => undefined}
            onRememberRecentColor={() => undefined}
            onHeaderButtonsVisibleChange={() => undefined}
          />
        </div>

        <Surface
          className="taskmap-ui-lab-text-block__major"
          data-ui-lab-drag-material="major"
          material="major-glass"
          radius={23}
        >
          <div className="taskmap-ui-lab-text-block__material-label">
            <strong>Major glass</strong>
            <span>Move the red node behind this live surface</span>
          </div>
          <Surface
            className="taskmap-ui-lab-text-block__minor"
            data-ui-lab-drag-material="minor"
            material="minor-glass"
            radius={13.5}
          >
            <div className="taskmap-ui-lab-text-block__material-label">
              <strong>Minor glass</strong>
              <span>Nested live sampling</span>
            </div>
          </Surface>
        </Surface>

        <div className="taskmap-ui-lab-text-block__foreground">
          <span>Foreground controls</span>
          <Button size="compact" onClick={resetPosition}>
            Reset node
          </Button>
        </div>
      </div>
    </section>
  );
}
