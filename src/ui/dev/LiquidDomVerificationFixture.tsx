import { Badge, Button, Group, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LiquidDomRoot, LiquidMaterialSurface } from "../materials/liquid-dom";
import "./LiquidDomVerificationFixture.css";

interface FixtureViewport {
  panX: number;
  panY: number;
  zoom: number;
  drag: null | {
    pointerId: number;
    clientX: number;
    clientY: number;
    panX: number;
    panY: number;
  };
}

function InteractiveDomBackdrop() {
  const backdropRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const viewportRef = useRef<FixtureViewport>({ panX: 0, panY: 0, zoom: 1, drag: null });

  const applyViewport = useCallback(() => {
    const world = worldRef.current;
    const zoomLabel = zoomLabelRef.current;
    const viewport = viewportRef.current;
    if (world) {
      world.style.transform = `translate3d(${viewport.panX}px, ${viewport.panY}px, 0) scale(${viewport.zoom})`;
    }
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(viewport.zoom * 100)}%`;
    }
  }, []);

  useLayoutEffect(applyViewport, [applyViewport]);

  useEffect(() => {
    const belongsToBackdropCanvas = (event: Event) => {
      const backdrop = backdropRef.current;
      const target = event.target instanceof Element ? event.target : null;
      if (!backdrop || target?.closest(".taskmap-liquid-material-content")) {
        return false;
      }
      const canvas = backdrop.closest("canvas");
      return Boolean(
        target && (backdrop.contains(target) || (canvas && event.composedPath().includes(canvas))),
      );
    };
    const startPan = (event: PointerEvent) => {
      if (!belongsToBackdropCanvas(event) || (event.button !== 0 && event.button !== 1)) {
        return;
      }
      event.preventDefault();
      const viewport = viewportRef.current;
      viewport.drag = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        panX: viewport.panX,
        panY: viewport.panY,
      };
      backdropRef.current?.setPointerCapture?.(event.pointerId);
      if (backdropRef.current) {
        backdropRef.current.dataset.panning = "true";
      }
    };
    const stopPan = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      if (viewport.drag?.pointerId === event.pointerId) {
        viewport.drag = null;
        backdropRef.current?.removeAttribute("data-panning");
      }
    };
    const movePan = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      const drag = viewport.drag;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      viewport.panX = drag.panX + event.clientX - drag.clientX;
      viewport.panY = drag.panY + event.clientY - drag.clientY;
      applyViewport();
    };
    const zoomCanvas = (event: WheelEvent) => {
      if (!belongsToBackdropCanvas(event)) {
        return;
      }
      event.preventDefault();
      const backdrop = backdropRef.current;
      if (!backdrop) {
        return;
      }
      const rect = backdrop.getBoundingClientRect();
      const viewport = viewportRef.current;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const worldX = (localX - viewport.panX) / viewport.zoom;
      const worldY = (localY - viewport.panY) / viewport.zoom;
      const zoom = Math.min(2.2, Math.max(0.5, viewport.zoom * Math.exp(-event.deltaY * 0.0012)));
      viewport.zoom = zoom;
      viewport.panX = localX - worldX * zoom;
      viewport.panY = localY - worldY * zoom;
      applyViewport();
    };

    window.addEventListener("pointerdown", startPan, true);
    window.addEventListener("pointermove", movePan, true);
    window.addEventListener("pointerup", stopPan, true);
    window.addEventListener("pointercancel", stopPan, true);
    window.addEventListener("wheel", zoomCanvas, { passive: false, capture: true });
    return () => {
      window.removeEventListener("pointerdown", startPan, true);
      window.removeEventListener("pointermove", movePan, true);
      window.removeEventListener("pointerup", stopPan, true);
      window.removeEventListener("pointercancel", stopPan, true);
      window.removeEventListener("wheel", zoomCanvas, true);
    };
  }, [applyViewport]);

  const resetViewport = () => {
    Object.assign(viewportRef.current, { panX: 0, panY: 0, zoom: 1, drag: null });
    backdropRef.current?.removeAttribute("data-panning");
    applyViewport();
  };

  return (
    <div
      ref={backdropRef}
      className="liquid-dom-fixture__backdrop"
      data-testid="liquid-dom-backdrop"
      onDoubleClick={resetViewport}
    >
      <div ref={worldRef} className="liquid-dom-fixture__world" data-testid="liquid-dom-world">
        <div className="liquid-dom-fixture__grid" />
        <div className="liquid-dom-fixture__heading">
          <Badge variant="light" color="cyan">
            Development fixture
          </Badge>
          <Title order={1}>Live DOM through Liquid DOM glass</Title>
          <Text c="dimmed">
            Drag this canvas or use the mouse wheel. The glass panels remain fixed above it.
          </Text>
        </div>
        <p className="liquid-dom-fixture__backdrop-copy">
          Live ordinary DOM text - Renderer V2 - Live ordinary DOM text - Renderer V2
        </p>
        <div className="liquid-dom-fixture__moving-orbit" aria-hidden="true">
          <img src="/app-icon.png" alt="" draggable={false} />
          <span>moving DOM + image</span>
        </div>
        <img
          className="liquid-dom-fixture__backdrop-image"
          src="/app-icon.png"
          alt="TaskMap application icon behind the Liquid DOM surfaces"
          draggable={false}
        />
      </div>
      <div className="liquid-dom-fixture__navigation-hint">
        Drag to pan / Wheel to zoom / Double-click to reset / <span ref={zoomLabelRef}>100%</span>
      </div>
      <Text className="liquid-dom-fixture__note" size="sm">
        WebGPU and Chromium's experimental canvas DrawElement support are required for live DOM
        capture. Unsupported runtimes show the boundary's opaque fallback.
      </Text>
    </div>
  );
}

export function LiquidDomVerificationFixture() {
  const [saveCount, setSaveCount] = useState(0);
  const [openedCanvas, setOpenedCanvas] = useState("None");

  return (
    <main className="liquid-dom-fixture">
      <LiquidDomRoot
        className="liquid-dom-fixture__stage"
        backdrop={<InteractiveDomBackdrop />}
        aria-label="Liquid DOM material verification fixture"
      >
        <div className="liquid-dom-fixture__surfaces">
          <LiquidMaterialSurface
            role="large-panel"
            className="liquid-dom-fixture__surface liquid-dom-fixture__surface--large"
          >
            <Stack p="xl" gap="md" justify="center" h="100%">
              <Badge variant="outline" color="gray" w="fit-content">
                Large Panel
              </Badge>
              <Title order={2}>Mantine content inside glass</Title>
              <TextInput label="Task title" placeholder="Plan Renderer V2" />
              <Group>
                <Button onClick={() => setSaveCount((count) => count + 1)}>
                  Save proof{saveCount > 0 ? ` (${saveCount})` : ""}
                </Button>
                <Button variant="subtle" color="gray" onClick={() => setSaveCount(0)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          </LiquidMaterialSurface>

          <LiquidMaterialSurface
            role="small-panel"
            className="liquid-dom-fixture__surface liquid-dom-fixture__surface--small"
          >
            <Stack p="lg" gap="sm" justify="center" h="100%">
              <Badge variant="outline" color="gray" w="fit-content">
                Small Panel
              </Badge>
              <Select
                label="Canvas"
                defaultValue="renderer-v2"
                data={[
                  { value: "renderer-v2", label: "Renderer V2" },
                  { value: "reference", label: "Reference canvas" },
                ]}
                comboboxProps={{ withinPortal: false }}
              />
              <Button variant="light" onClick={() => setOpenedCanvas("Renderer V2")}>
                Open canvas
              </Button>
              <Text size="xs" c="dimmed">
                Opened: {openedCanvas}
              </Text>
            </Stack>
          </LiquidMaterialSurface>
        </div>
      </LiquidDomRoot>
    </main>
  );
}
