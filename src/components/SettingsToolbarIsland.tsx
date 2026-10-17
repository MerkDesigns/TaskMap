import { IconLayoutNavbar } from "@tabler/icons-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  PINNED_TOOLBAR_BUTTON,
  TOOLBAR_BUTTON_IDS,
  TOOLBAR_SLOT_COUNT,
  type ToolbarButtonId,
} from "../platform/settings/preferenceContracts";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { SettingsIsland } from "../ui/patterns/settings/SettingsPatterns";
import { useWorkspaceRadii } from "../ui/patterns/workspace/workspaceRadii";
import { IconButton } from "../ui/primitives/Button";
import "../ui/patterns/workspace/ChromeControlGroup.css";
import {
  arrangeToolbar,
  toolbarArrangement,
  type ToolbarDragSource,
  type ToolbarDropTarget,
} from "./toolbarButtonLayout";
import {
  TOOLBAR_BUTTONS,
  toolbarButtonIcon,
  toolbarButtonPressed,
  type ToolbarToggleStates,
} from "./toolbarButtons";
import "./SettingsToolbarIsland.css";

// The real toolbar's geometry: a 40px group with 8px padding around 28px buttons 4px apart.
const TILE = 28;
const GAP = 4;
const PITCH = TILE + GAP;
const BAR_PADDING = 8;
const BAR_HEIGHT = 40;
const TILE_TOP = (BAR_HEIGHT - TILE) / 2;
/** Space on each side of the divider between the toolbar and the tray. */
const DIVIDER_SPACE = 12;
const DIVIDER_WIDTH = 1;
const CAPTION_TOP = BAR_HEIGHT + 6;
// Every button is in exactly one bar, so the two bars together always span the same width.
const STAGE_WIDTH =
  barWidth(TOOLBAR_BUTTON_IDS.length) + 2 * BAR_PADDING + 2 * DIVIDER_SPACE + DIVIDER_WIDTH - GAP;
const STAGE_HEIGHT = CAPTION_TOP + 16;
/** Movement before a press becomes a drag, so a plain click never rearranges anything. */
const DRAG_THRESHOLD = 3;
/** How far outside the stage a button still counts as over it. */
const STAGE_TOLERANCE = 24;

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ToolbarDrag {
  readonly source: ToolbarDragSource;
  readonly pointerId: number;
  readonly start: Point;
  /** Where the button sat when it was picked up, in stage coordinates. */
  readonly origin: Point;
  /** The stage's top-left corner on screen, read once when the press starts. */
  readonly stage: Point;
  readonly delta: Point;
  readonly moving: boolean;
  readonly target: ToolbarDropTarget;
}

export interface SettingsToolbarIslandProps {
  readonly buttons: readonly ToolbarButtonId[];
  readonly toggles: ToolbarToggleStates;
  readonly onButtonsChange: (buttons: ToolbarButtonId[]) => void;
}

/**
 * Arranges the toolbar like icons on a phone home screen: buttons are picked up and dropped between
 * others, which slide aside, into the tray of unused buttons, or onto a toolbar button to trade
 * places with it.
 */
export function SettingsToolbarIsland({
  buttons,
  toggles,
  onButtonsChange,
}: SettingsToolbarIslandProps) {
  const radius = useWorkspaceRadii().chrome;
  // Shown until the saved preference comes back, so a dropped button never jumps back first.
  const [pending, setPending] = useState<readonly ToolbarButtonId[] | null>(null);
  const [drag, setDrag] = useState<ToolbarDrag | null>(null);
  useEffect(() => setPending(null), [buttons]);
  const toolbar = pending ?? buttons;

  const commit = (source: ToolbarDragSource, target: ToolbarDropTarget) => {
    const next = arrangeToolbar(toolbar, source, target).toolbar;
    if (next === toolbar) return;
    setPending(next);
    onButtonsChange([...next]);
  };

  // A swap is only marked until the drop, when the two buttons trade places.
  const shown =
    drag?.moving && drag.target.kind !== "swap"
      ? arrangeToolbar(toolbar, drag.source, drag.target)
      : toolbarArrangement(toolbar);
  const positions = new Map<ToolbarButtonId, Point>();
  shown.toolbar.forEach((id, index) => positions.set(id, toolbarSlot(index)));
  shown.tray.forEach((id, index) => positions.set(id, traySlot(index, shown.toolbar.length)));
  const base = toolbarArrangement(toolbar);
  // A button dragged nowhere still holds its old place.
  if (drag?.moving && !positions.has(drag.source.id)) positions.set(drag.source.id, drag.origin);

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    source: ToolbarDragSource,
  ) => {
    if (event.button !== 0 || drag) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const stage = event.currentTarget.parentElement!.getBoundingClientRect();
    const index =
      source.from === "toolbar" ? base.toolbar.indexOf(source.id) : base.tray.indexOf(source.id);
    setDrag({
      source,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: source.from === "toolbar" ? toolbarSlot(index) : traySlot(index, base.toolbar.length),
      stage: { x: stage.left, y: stage.top },
      delta: { x: 0, y: 0 },
      moving: false,
      target: { kind: "none" },
    });
  };

  // The window, not the button, follows the drag: pointer capture is not always granted (or is
  // lost), and a release that lands elsewhere must still end the drag.
  const latest = useRef({ drag, toolbar, commit });
  useLayoutEffect(() => {
    latest.current = { drag, toolbar, commit };
  });
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const { drag: current, toolbar: arranged } = latest.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y };
      const moving = current.moving || Math.hypot(delta.x, delta.y) >= DRAG_THRESHOLD;
      const pointer = { x: event.clientX - current.stage.x, y: event.clientY - current.stage.y };
      setDrag({
        ...current,
        delta,
        moving,
        target: moving ? dropTargetAt(pointer, arranged, current.source) : current.target,
      });
    };
    const end = (event: PointerEvent) => {
      const { drag: current, toolbar: arranged, commit: drop } = latest.current;
      if (!current || event.pointerId !== current.pointerId) return;
      if (current.moving && event.type === "pointerup") {
        const pointer = { x: event.clientX - current.stage.x, y: event.clientY - current.stage.y };
        drop(current.source, dropTargetAt(pointer, arranged, current.source));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]);

  const handleKeyDown = (event: ReactKeyboardEvent, source: ToolbarDragSource) => {
    const index = toolbar.indexOf(source.id);
    let target: ToolbarDropTarget | null = null;
    if (source.from === "toolbar") {
      if (event.key === "ArrowLeft") target = { kind: "toolbar", index: index - 1 };
      if (event.key === "ArrowRight") target = { kind: "toolbar", index: index + 1 };
      if (event.key === "ArrowDown" || event.key === "Delete") target = { kind: "tray" };
    } else if (event.key === "ArrowUp" || event.key === "Enter") {
      target = { kind: "toolbar", index: toolbar.length };
    }
    if (!target) return;
    event.preventDefault();
    commit(source, target);
  };

  return (
    <SettingsIsland>
      <div className="taskmap-settings-section-heading">
        <IconLayoutNavbar size={16} stroke={2} />
        <span>Customize Toolbar</span>
      </div>
      <div
        className="taskmap-toolbar-layout taskmap-chrome-control-group"
        role="group"
        aria-label="Toolbar layout"
        style={
          {
            width: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            "--taskmap-material-radius": `${radius}px`,
          } as CSSProperties
        }
      >
        <MaterialSurface
          material="acrylic-large"
          elevation="none"
          radius={radius}
          className="taskmap-toolbar-layout__bar"
          style={{ left: 0, width: barWidth(shown.toolbar.length) }}
        />
        <span className="taskmap-toolbar-layout__caption" style={{ left: 0, top: CAPTION_TOP }}>
          Active Toolbar
        </span>
        <span
          className="taskmap-toolbar-layout__divider"
          style={{ left: barWidth(shown.toolbar.length) + DIVIDER_SPACE }}
        />
        <MaterialSurface
          material="acrylic-large"
          elevation="none"
          radius={radius}
          className="taskmap-toolbar-layout__bar"
          style={{ left: trayLeft(shown.toolbar.length), width: barWidth(shown.tray.length) }}
        />
        <span
          className="taskmap-toolbar-layout__caption"
          style={{ left: trayLeft(shown.toolbar.length), top: CAPTION_TOP }}
        >
          Unused buttons
        </span>
        {TOOLBAR_BUTTON_IDS.map((id) => {
          const { label } = TOOLBAR_BUTTONS[id];
          const Icon = toolbarButtonIcon(id, toggles);
          const from = base.toolbar.includes(id) ? "toolbar" : "tray";
          const held = drag?.moving && drag.source.id === id;
          const position = held
            ? { x: drag.origin.x + drag.delta.x, y: drag.origin.y + drag.delta.y }
            : positions.get(id)!;
          const swapping = drag?.moving && drag.target.kind === "swap" && drag.target.id === id;
          return (
            <IconButton
              key={id}
              variant="ghost"
              size="compact"
              className="taskmap-toolbar-layout__tile"
              data-held={held || undefined}
              data-swap-target={swapping || undefined}
              data-pressed={toolbarButtonPressed(id, toggles) || undefined}
              aria-label={from === "toolbar" ? label : `${label} (unused)`}
              title={id === PINNED_TOOLBAR_BUTTON ? `${label} always stays in the toolbar` : label}
              style={{ translate: `${position.x}px ${position.y}px` }}
              onPointerDown={(event) => handlePointerDown(event, { id, from })}
              onKeyDown={(event) => handleKeyDown(event, { id, from })}
              icon={<Icon size={18} stroke={2} />}
            />
          );
        })}
      </div>
    </SettingsIsland>
  );
}

function barWidth(buttons: number): number {
  return buttons * PITCH - GAP + 2 * BAR_PADDING;
}

function toolbarSlot(index: number): Point {
  return { x: BAR_PADDING + index * PITCH, y: TILE_TOP };
}

function trayLeft(toolbarButtons: number): number {
  return barWidth(toolbarButtons) + 2 * DIVIDER_SPACE + DIVIDER_WIDTH;
}

function traySlot(index: number, toolbarButtons: number): Point {
  return { x: trayLeft(toolbarButtons) + BAR_PADDING + index * PITCH, y: TILE_TOP };
}

/**
 * Where the dragged button would land. This reads the arrangement from before the drag, not the
 * one on screen, so buttons sliding aside never move the target out from under the pointer.
 */
function dropTargetAt(
  pointer: Point,
  toolbar: readonly ToolbarButtonId[],
  source: ToolbarDragSource,
): ToolbarDropTarget {
  if (
    pointer.x < -STAGE_TOLERANCE ||
    pointer.x > STAGE_WIDTH + STAGE_TOLERANCE ||
    pointer.y < -STAGE_TOLERANCE ||
    pointer.y > STAGE_HEIGHT + STAGE_TOLERANCE
  ) {
    return { kind: "none" };
  }
  if (pointer.x >= barWidth(toolbar.length) + DIVIDER_SPACE) {
    return source.from === "toolbar" ? { kind: "tray" } : { kind: "none" };
  }
  const x = pointer.x - BAR_PADDING;
  if (source.from === "toolbar") {
    const others = toolbar.length - 1;
    return { kind: "toolbar", index: clamp(Math.floor((x + GAP / 2) / PITCH), 0, others) };
  }
  if (toolbar.length >= TOOLBAR_SLOT_COUNT) {
    const slot = clamp(Math.floor((x + GAP / 2) / PITCH), 0, toolbar.length - 1);
    return { kind: "swap", id: toolbar[slot] };
  }
  const slot = Math.max(0, Math.floor(x / PITCH));
  if (slot >= toolbar.length) return { kind: "toolbar", index: toolbar.length };
  // The middle of a button swaps with it; its edges insert beside it.
  const across = (x - slot * PITCH) / TILE;
  if (across > 0.25 && across < 0.75 && toolbar[slot] !== PINNED_TOOLBAR_BUTTON) {
    return { kind: "swap", id: toolbar[slot] };
  }
  return { kind: "toolbar", index: across < 0.5 ? slot : slot + 1 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
