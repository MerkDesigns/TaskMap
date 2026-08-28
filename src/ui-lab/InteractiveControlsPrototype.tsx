import { useState, type CSSProperties, type ReactNode } from "react";
import { Field } from "../ui/primitives/Field";
import { Button } from "../ui/primitives/Button";
import { LiquidTabs } from "../ui/primitives/LiquidTabs";
import { LiquidToggleSwitch } from "../ui/primitives/LiquidToggleSwitch";
import { Slider } from "../ui/primitives/SelectionControls";
import { FormControlsPrototype } from "./FormControlsPrototype";
import "./interactiveControlsPrototype.css";

const VERTICAL_ITEMS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "canvas", label: "Canvas" },
  { value: "shortcuts", label: "Shortcuts" },
  { value: "unavailable", label: "Unavailable", disabled: true },
] as const;

const HORIZONTAL_ITEMS = [
  { value: "general", label: "General" },
  { value: "appearance", label: "Appearance" },
  { value: "advanced", label: "Advanced" },
] as const;

type VerticalValue = (typeof VERTICAL_ITEMS)[number]["value"];
type HorizontalValue = (typeof HORIZONTAL_ITEMS)[number]["value"];

export function InteractiveControlsPrototype() {
  const [verticalValue, setVerticalValue] = useState<VerticalValue>("general");
  const [horizontalValue, setHorizontalValue] = useState<HorizontalValue>("general");
  const [toggleEnabled, setToggleEnabled] = useState(false);
  const [indicatorRadius, setIndicatorRadius] = useState(7);
  const [movingIndicatorRadius, setMovingIndicatorRadius] = useState(14);
  const [backgroundRadius, setBackgroundRadius] = useState(11);
  const [toggleTintOpacity, setToggleTintOpacity] = useState(0.67);
  const [confirmationCount, setConfirmationCount] = useState(0);
  const [lastAction, setLastAction] = useState("No action yet");

  return (
    <section
      className="taskmap-ui-lab-controls"
      aria-labelledby="interactive-controls-prototype-title"
    >
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Production interactive primitives</span>
        <h2 id="interactive-controls-prototype-title">Interactive controls prototype</h2>
        <p>Real shared controls with local UI Lab state for interaction inspection.</p>
      </div>

      <div className="taskmap-ui-lab-controls__grid">
        <article className="taskmap-ui-lab-controls__sample">
          <ControlHeading
            title="Vertical tabs"
            description="Click or use Up, Down, Home, and End."
          />
          <div className="taskmap-ui-lab-controls__vertical-demo">
            <LiquidTabs
              label="Workspace settings sections"
              items={VERTICAL_ITEMS}
              orientation="vertical"
              indicatorRadius={indicatorRadius}
              movingIndicatorRadius={movingIndicatorRadius}
              backgroundRadius={backgroundRadius}
              value={verticalValue}
              onValueChange={setVerticalValue}
            />
            <output className="taskmap-ui-lab-controls__status">
              Selected: {labelFor(VERTICAL_ITEMS, verticalValue)}
            </output>
          </div>
        </article>

        <article className="taskmap-ui-lab-controls__sample">
          <ControlHeading
            title="Horizontal tabs"
            description="The unchanged default production orientation."
          />
          <LiquidTabs
            label="Workspace preferences"
            items={HORIZONTAL_ITEMS}
            indicatorRadius={indicatorRadius}
            movingIndicatorRadius={movingIndicatorRadius}
            backgroundRadius={backgroundRadius}
            value={horizontalValue}
            onValueChange={setHorizontalValue}
          />
          <output className="taskmap-ui-lab-controls__status">
            Selected: {labelFor(HORIZONTAL_ITEMS, horizontalValue)}
          </output>
          <div className="taskmap-ui-lab-controls__radius-controls">
            <RadiusControl
              label="Settled blob radius"
              value={indicatorRadius}
              onChange={setIndicatorRadius}
            />
            <RadiusControl
              label="Background island radius"
              value={backgroundRadius}
              onChange={setBackgroundRadius}
            />
            <RadiusControl
              label="Moving blob radius"
              value={movingIndicatorRadius}
              onChange={setMovingIndicatorRadius}
            />
          </div>
        </article>

        <article className="taskmap-ui-lab-controls__sample">
          <ControlHeading
            title="Toggle switch"
            description="Production liquid knob motion and disabled state."
          />
          <div className="taskmap-ui-lab-controls__rows">
            <ControlRow label="30px option">
              <LiquidToggleSwitch
                size={30}
                checked={toggleEnabled}
                label="30px toggle option"
                style={
                  {
                    "--taskmap-liquid-toggle-tint-opacity": toggleTintOpacity,
                  } as CSSProperties
                }
                onCheckedChange={setToggleEnabled}
              />
            </ControlRow>
          </div>
          <output className="taskmap-ui-lab-controls__status">
            Toggle: {toggleEnabled ? "On" : "Off"}
          </output>
          <Field label={`Dark tint opacity · ${toggleTintOpacity.toFixed(2)}`}>
            <Slider
              aria-label="Toggle dark tint opacity"
              min={0}
              max={0.8}
              value={toggleTintOpacity}
              onChange={(event) => setToggleTintOpacity(Number(event.currentTarget.value))}
            />
          </Field>
        </article>

        <article className="taskmap-ui-lab-controls__sample">
          <ControlHeading
            title="Action button"
            description="Production semantic variants and disabled state."
          />
          <div className="taskmap-ui-lab-controls__actions">
            <Button
              variant="primary"
              onClick={() => {
                setConfirmationCount((count) => count + 1);
                setLastAction("Confirmed");
              }}
            >
              Confirm
            </Button>
            <Button variant="secondary" onClick={() => setLastAction("Cancelled")}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setLastAction("Delete requested")}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setLastAction("Details opened")}>
              Details
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
          <output className="taskmap-ui-lab-controls__status">
            {lastAction}
            {confirmationCount > 0
              ? ` · Confirmed ${confirmationCount} time${confirmationCount === 1 ? "" : "s"}`
              : ""}
          </output>
        </article>
      </div>

      <FormControlsPrototype />
    </section>
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
        max={20}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </Field>
  );
}

function ControlHeading({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) {
  return (
    <header className="taskmap-ui-lab-controls__heading">
      <h3>{title}</h3>
      <p>{description}</p>
    </header>
  );
}

function ControlRow({ children, label }: { readonly children: ReactNode; readonly label: string }) {
  return (
    <div className="taskmap-ui-lab-controls__row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function labelFor<Value extends string>(
  items: readonly { readonly value: Value; readonly label: string }[],
  value: Value,
): string {
  return items.find((item) => item.value === value)?.label ?? value;
}
