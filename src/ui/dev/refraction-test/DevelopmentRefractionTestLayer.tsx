import { Button, Group, Portal } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { memo, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import "./DevelopmentRefractionTestLayer.css";

interface TestElement {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface DevelopmentRefractionTestLayerProps {
  readonly activeCanvasId: string | null;
}

export function DevelopmentRefractionTestLayer({
  activeCanvasId,
}: DevelopmentRefractionTestLayerProps) {
  const nextIdRef = useRef(1);
  const [elementsByCanvas, setElementsByCanvas] = useState<
    Readonly<Record<string, readonly TestElement[]>>
  >({});
  const activeElements = activeCanvasId ? (elementsByCanvas[activeCanvasId] ?? []) : [];

  const addElement = () => {
    if (!activeCanvasId) return;
    const id = nextIdRef.current++;
    const element = createTestElement(id);
    setElementsByCanvas((current) => ({
      ...current,
      [activeCanvasId]: [...(current[activeCanvasId] ?? []), element],
    }));
  };

  const moveElement = (id: number, x: number, y: number) => {
    if (!activeCanvasId) return;
    setElementsByCanvas((current) => ({
      ...current,
      [activeCanvasId]: (current[activeCanvasId] ?? []).map((element) =>
        element.id === id ? { ...element, x, y } : element,
      ),
    }));
  };

  const clearElements = () => {
    if (!activeCanvasId) return;
    setElementsByCanvas((current) => ({ ...current, [activeCanvasId]: [] }));
  };

  return (
    <>
      {activeElements.map((element) => (
        <DevelopmentRefractionTestElement key={element.id} element={element} onMove={moveElement} />
      ))}
      <Portal>
        <Group className="taskmap-refraction-test-controls" gap="xs">
          <Button
            size="sm"
            leftSection={<IconPlus size={16} />}
            disabled={!activeCanvasId}
            onClick={addElement}
          >
            Add test element
          </Button>
          {activeElements.length > 0 ? (
            <Button
              size="sm"
              variant="default"
              leftSection={<IconTrash size={15} />}
              onClick={clearElements}
            >
              Clear
            </Button>
          ) : null}
        </Group>
      </Portal>
    </>
  );
}

export function createTestElement(id: number): TestElement {
  const column = (id - 1) % 4;
  const row = Math.floor((id - 1) / 4);
  return {
    id,
    x: 120 + column * 280,
    y: 30 + row * 190,
  };
}

const DevelopmentRefractionTestElement = memo(function DevelopmentRefractionTestElement({
  element,
  onMove,
}: {
  readonly element: TestElement;
  readonly onMove: (id: number, x: number, y: number) => void;
}) {
  const elementRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    scale: number;
  } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const world = elementRef.current?.parentElement;
    const matrix = new DOMMatrix(getComputedStyle(world ?? event.currentTarget).transform);
    dragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: element.x,
      y: element.y,
      scale: Math.max(0.01, Math.abs(matrix.a) || 1),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const node = elementRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !node) return;
    const x = drag.x + (event.clientX - drag.clientX) / drag.scale;
    const y = drag.y + (event.clientY - drag.clientY) / drag.scale;
    node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const finishDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = drag.x + (event.clientX - drag.clientX) / drag.scale;
    const y = drag.y + (event.clientY - drag.clientY) / drag.scale;
    dragRef.current = null;
    onMove(element.id, x, y);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <article
      ref={elementRef}
      className="taskmap-refraction-test-element"
      style={{ transform: `translate3d(${element.x}px, ${element.y}px, 0)` }}
      data-testid="refraction-test-element"
    >
      <header
        className="taskmap-refraction-test-element__header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <strong>Refraction sample {element.id}</strong>
        <span>Drag me</span>
      </header>
      <div className="taskmap-refraction-test-element__body">
        <img src="/app-icon.png" alt="TaskMap test graphic" draggable={false} />
        <p>
          Ordinary live DOM text behind Liquid glass. Pan, zoom, or drag this card beneath the
          browser to inspect blur and refraction.
        </p>
      </div>
      <div className="taskmap-refraction-test-element__motion" aria-hidden="true">
        <span />
      </div>
    </article>
  );
});
