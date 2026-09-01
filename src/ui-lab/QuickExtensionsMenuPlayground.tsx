import { useEffect, useRef, useState } from "react";
import { QuickExtensionsMenu, type ExtensionId } from "../components/ExtensionsPanel";
import { Field } from "../ui/primitives/Field";
import { Slider } from "../ui/primitives/SelectionControls";
import { CanvasFrame } from "../ui/patterns/workspace/CanvasFrame";
import "./quickExtensionsMenuPlayground.css";

interface MenuPosition {
  readonly left: number;
  readonly top: number;
  readonly closing: boolean;
}

export function QuickExtensionsMenuPlayground() {
  const lastPointerPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [lastDrop, setLastDrop] = useState("No extension dropped");
  const [majorRadius, setMajorRadius] = useState(17);
  const [minorRadius, setMinorRadius] = useState(9);
  const [iconRadius, setIconRadius] = useState(7);
  const [iconBackgroundOpacity, setIconBackgroundOpacity] = useState(0.75);

  useEffect(() => {
    const trackPointer = (event: globalThis.PointerEvent) => {
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
    };
    const openQuickExtensions = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const focusedControl = target?.closest("button, [role='button'], a, select, [tabindex]");
      if (
        !event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key.toLowerCase() !== "e" ||
        editing ||
        focusedControl
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setMenuPosition({
        left: lastPointerPositionRef.current.x,
        top: lastPointerPositionRef.current.y,
        closing: false,
      });
    };

    window.addEventListener("pointermove", trackPointer, true);
    window.addEventListener("keydown", openQuickExtensions);
    return () => {
      window.removeEventListener("pointermove", trackPointer, true);
      window.removeEventListener("keydown", openQuickExtensions);
    };
  }, []);

  const recordDrop = (extensionId: ExtensionId, clientX: number, clientY: number) => {
    setLastDrop(`${extensionId} dropped at ${Math.round(clientX)}, ${Math.round(clientY)}`);
  };

  return (
    <section
      className="taskmap-ui-lab-quick-extensions"
      aria-labelledby="quick-extensions-playground-title"
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Production extension browser</span>
        <h2 id="quick-extensions-playground-title">Quick Extensions Menu playground</h2>
        <p>Move the pointer over the canvas and press Shift+E.</p>
      </div>

      <div className="taskmap-ui-lab-quick-extensions__controls">
        <RadiusControl label="Major panel radius" value={majorRadius} onChange={setMajorRadius} />
        <RadiusControl label="Minor panel radius" value={minorRadius} onChange={setMinorRadius} />
        <RadiusControl label="Cutout icon radius" value={iconRadius} onChange={setIconRadius} />
        <OpacityControl value={iconBackgroundOpacity} onChange={setIconBackgroundOpacity} />
      </div>

      <CanvasFrame
        className="taskmap-ui-lab-quick-extensions__canvas"
        data-grid-style="dots"
        aria-label="Quick Extensions drop canvas"
      >
        <span>Drag an extension out of the menu and release it here.</span>
        <output>{lastDrop}</output>
      </CanvasFrame>

      {menuPosition ? (
        <QuickExtensionsMenu
          left={menuPosition.left}
          top={menuPosition.top}
          majorRadius={majorRadius}
          minorRadius={minorRadius}
          iconRadius={iconRadius}
          iconBackgroundOpacity={iconBackgroundOpacity}
          open={!menuPosition.closing}
          onRequestClose={() =>
            setMenuPosition((current) => (current ? { ...current, closing: true } : current))
          }
          onExitComplete={() => setMenuPosition(null)}
          onDropExtension={recordDrop}
        />
      ) : null}
    </section>
  );
}

function OpacityControl({
  value,
  onChange,
}: {
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <Field label={`Cutout background opacity · ${Math.round(value * 100)}%`}>
      <Slider
        aria-label="Cutout background opacity"
        min={0}
        max={1}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </Field>
  );
}

function RadiusControl({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <Field label={`${label} · ${value.toFixed(1)}px`}>
      <Slider
        aria-label={label}
        min={0}
        max={24}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </Field>
  );
}
