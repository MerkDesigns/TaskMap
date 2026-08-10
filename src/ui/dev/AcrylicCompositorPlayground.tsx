import { IconRefresh } from "@tabler/icons-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import type { CanvasRectangle, CanvasSize } from "../../canvas/geometry/canvasGeometry";
import { MaterialSurface } from "../materials/MaterialSurface";
import { useMaterialSurfaceGeometryInvalidation } from "../materials/MaterialSurfaceRegistration";
import type { BackdropScene } from "../materials/compositor/backdropScene";
import type { MaterialCompositorPresentationPublisher } from "../materials/materialCompositorPresentation";
import { Button, Field, Inline, Select, Stack } from "../primitives";
import {
  ACRYLIC_PLAYGROUND_SCENE,
  ACRYLIC_PLAYGROUND_SURFACE_PRESETS,
  createAcrylicPlaygroundPresentation,
  findAcrylicPlaygroundSurfacePreset,
  panAcrylicPlaygroundView,
  resetAcrylicPlaygroundView,
  zoomAcrylicPlaygroundView,
  type AcrylicPlaygroundSurfacePresetId,
} from "./acrylicPlaygroundModel";
import { ContextMenuDemo } from "./ContextMenuDemo";
import "./AcrylicCompositorPlayground.css";

const FALLBACK_SIZE = Object.freeze({ width: 680, height: 360 });

export interface AcrylicCompositorPlaygroundProps {
  readonly presentation: MaterialCompositorPresentationPublisher;
}

export function AcrylicCompositorPlayground({ presentation }: AcrylicCompositorPlaygroundProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const initializedRef = useRef(false);
  const invalidateSurfaceGeometry = useMaterialSurfaceGeometryInvalidation();
  const [hostBounds, setHostBounds] = useState<CanvasRectangle>({
    x: 0,
    y: 0,
    ...FALLBACK_SIZE,
  });
  const [windowSize, setWindowSize] = useState<CanvasSize>(FALLBACK_SIZE);
  const [view, setView] = useState(() => resetAcrylicPlaygroundView(FALLBACK_SIZE));
  const [interactionActive, setInteractionActive] = useState(false);
  const [presetId, setPresetId] = useState<AcrylicPlaygroundSurfacePresetId>("large-panel");
  const preset = findAcrylicPlaygroundSurfacePreset(presetId);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const labRoot = viewport.closest(".taskmap-ui-lab");
    const measure = () => {
      const bounds = viewport.getBoundingClientRect();
      const size = { width: bounds.width || FALLBACK_SIZE.width, height: bounds.height || 360 };
      setHostBounds((current) => {
        const next = { x: bounds.left, y: bounds.top, ...size };
        return sameRectangle(current, next) ? current : next;
      });
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      if (!initializedRef.current) {
        initializedRef.current = true;
        setView(resetAcrylicPlaygroundView(size));
      }
      invalidateSurfaceGeometry();
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    window.addEventListener("resize", measure);
    labRoot?.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      labRoot?.removeEventListener("scroll", measure);
    };
  }, [invalidateSurfaceGeometry]);

  useEffect(() => {
    presentation.publish(
      createAcrylicPlaygroundPresentation({
        scene: ACRYLIC_PLAYGROUND_SCENE,
        view,
        hostBounds,
        windowSize,
        interactionActive,
      }),
    );
  }, [hostBounds, interactionActive, presentation, view, windowSize]);

  useEffect(() => () => presentation.clear(), [presentation]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteractionActive(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = { x: event.clientX - drag.x, y: event.clientY - drag.y };
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setView((current) => panAcrylicPlaygroundView(current, delta));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setInteractionActive(false);
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    setView((current) => zoomAcrylicPlaygroundView(current, anchor, event.deltaY));
  };

  return (
    <section className="taskmap-ui-lab__section taskmap-acrylic-playground">
      <div>
        <h2>Acrylic compositor playground</h2>
        <p className="taskmap-ui-lab__muted">
          Drag the canvas to pan and use the wheel to zoom behind the fixed test surface.
        </p>
      </div>
      <Stack gap="normal">
        <Inline justify="space-between" align="end">
          <Field label="Test surface" className="taskmap-acrylic-playground__selector">
            <Select
              value={presetId}
              onValueChange={(value) => setPresetId(value as AcrylicPlaygroundSurfacePresetId)}
              options={ACRYLIC_PLAYGROUND_SURFACE_PRESETS.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
            />
          </Field>
          <Inline gap="small">
            <span className="taskmap-acrylic-playground__zoom" aria-live="polite">
              Zoom {Math.round(view.zoom * 100)}%
            </span>
            <Button
              size="compact"
              leadingIcon={<IconRefresh size={15} />}
              onClick={() => setView(resetAcrylicPlaygroundView(hostBounds))}
            >
              Reset View
            </Button>
          </Inline>
        </Inline>
        <div
          ref={viewportRef}
          className="taskmap-acrylic-playground__viewport"
          data-interaction-active={interactionActive}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onWheel={onWheel}
        >
          <PlaygroundSceneView scene={ACRYLIC_PLAYGROUND_SCENE} view={view} />
          <ContextMenuDemo embedded />
          <MaterialSurface
            material={preset.material}
            radius={preset.radius}
            elevation={preset.id === "liquid-selection" ? "none" : "default"}
            className={`taskmap-acrylic-playground__surface taskmap-acrylic-playground__surface--${preset.className}`}
          >
            <span>{preset.label.replace(" Panel", "").replace(" Card", "")}</span>
            {preset.note ? <small>{preset.note}</small> : null}
          </MaterialSurface>
        </div>
      </Stack>
    </section>
  );
}

function PlaygroundSceneView({
  scene,
  view,
}: {
  readonly scene: BackdropScene;
  readonly view: {
    readonly pan: { readonly x: number; readonly y: number };
    readonly zoom: number;
  };
}) {
  const grid = scene.grid;
  return (
    <svg className="taskmap-acrylic-playground__scene" aria-hidden="true">
      <defs>
        {grid?.kind === "dots" ? (
          <pattern
            id="taskmap-playground-grid"
            width={grid.spacingWorld}
            height={grid.spacingWorld}
            x={grid.offsetWorld.x}
            y={grid.offsetWorld.y}
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0" cy="0" r={grid.radiusWorld} fill={grid.color} />
          </pattern>
        ) : null}
      </defs>
      <g transform={`translate(${view.pan.x} ${view.pan.y}) scale(${view.zoom})`}>
        <rect
          {...scene.worldBounds}
          rx={scene.background.worldCornerRadius}
          fill={scene.background.worldFill}
        />
        {grid?.kind === "dots" ? (
          <rect {...scene.worldBounds} fill="url(#taskmap-playground-grid)" />
        ) : null}
        {scene.primitives.map((primitive, index) => (
          <rect
            key={index}
            x={primitive.bounds.x}
            y={primitive.bounds.y}
            width={primitive.bounds.width}
            height={primitive.bounds.height}
            rx={primitive.kind === "filled-rounded-rectangle" ? primitive.radiusWorld : 0}
            fill={primitive.fill}
            stroke={primitive.stroke?.color}
            strokeWidth={primitive.stroke?.widthWorld}
          />
        ))}
      </g>
    </svg>
  );
}

function sameRectangle(left: CanvasRectangle, right: CanvasRectangle): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
