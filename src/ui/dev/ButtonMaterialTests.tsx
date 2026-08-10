import { IconBolt, IconCheck, IconDots, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import {
  AcrylicConfirmButton,
  AcrylicToggleButton,
  AnimatedCheckbox,
  Button,
  IconButton,
  Inline,
  LiquidTabs,
  LiquidToggleSwitch,
  Panel,
} from "../primitives";
import "./ButtonMaterialTests.css";

export const BUTTON_MATERIAL_LIQUID_ITEMS = Object.freeze([
  { value: "one", label: "Option 1" },
  { value: "two", label: "Option 2" },
  { value: "three", label: "Option 3" },
  { value: "four", label: "Option 4" },
] as const);

export function ButtonMaterialTests() {
  const [togglePressed, setTogglePressed] = useState(false);
  const [liquidValue, setLiquidValue] = useState("one");
  const [liquidSwitch, setLiquidSwitch] = useState(false);
  const [confirmDisabled, setConfirmDisabled] = useState(false);
  const [animatedChecked, setAnimatedChecked] = useState(false);
  const [status, setStatus] = useState("Ready for interaction");
  return (
    <section className="taskmap-ui-lab__section">
      <h2>Button material tests</h2>
      <Panel material="acrylic-large">
        <div className="taskmap-button-material-test__layout">
          <div className="taskmap-button-material-test__controls">
            <TestControl label="Acrylic toggle">
              <AcrylicToggleButton
                pressed={togglePressed}
                icon={<IconBolt />}
                onClick={() => {
                  setTogglePressed((current) => !current);
                  setStatus("Acrylic toggle changed");
                }}
              >
                Acrylic toggle
              </AcrylicToggleButton>
            </TestControl>
            <TestControl label="Four-option liquid selection">
              <LiquidTabs
                label="Four-option material test"
                items={BUTTON_MATERIAL_LIQUID_ITEMS}
                value={liquidValue}
                onValueChange={(value) => {
                  setLiquidValue(value);
                  setStatus(`Liquid selection: ${value}`);
                }}
              />
            </TestControl>
            <TestControl label="Normal ghost button">
              <IconButton
                variant="ghost"
                icon={<IconDots />}
                aria-label="More options example"
                title="More options"
                onClick={() => setStatus("Ghost action invoked")}
              />
            </TestControl>
            <TestControl label="Liquid toggle switch">
              <LiquidToggleSwitch
                label="Liquid glass toggle"
                checked={liquidSwitch}
                onCheckedChange={(checked) => {
                  setLiquidSwitch(checked);
                  setStatus(`Liquid toggle: ${checked ? "on" : "off"}`);
                }}
              />
            </TestControl>
            <TestControl label="Normal confirm">
              <AcrylicConfirmButton
                icon={<IconCheck />}
                onClick={() => setStatus("Normal confirm action completed")}
              >
                Confirm
              </AcrylicConfirmButton>
            </TestControl>
            <TestControl label="Confirm + disable">
              <Inline gap="small">
                <AcrylicConfirmButton
                  icon={<IconCheck />}
                  disabled={confirmDisabled}
                  onClick={() => {
                    setConfirmDisabled(true);
                    setStatus("Confirm disabled until reset");
                  }}
                >
                  {confirmDisabled ? "Confirmed" : "Confirm"}
                </AcrylicConfirmButton>
                <Button
                  size="compact"
                  variant="ghost"
                  disabled={!confirmDisabled}
                  onClick={() => {
                    setConfirmDisabled(false);
                    setStatus("Confirm re-enabled");
                  }}
                >
                  Reset
                </Button>
              </Inline>
            </TestControl>
            <TestControl label="Glowing confirm">
              <AcrylicConfirmButton
                treatment="glowing"
                icon={<IconSparkles />}
                onClick={() => setStatus("Glowing confirm action completed")}
              >
                Confirm
              </AcrylicConfirmButton>
            </TestControl>
            <TestControl label="Animated checkbox">
              <AnimatedCheckbox
                label="Draw check mark"
                checked={animatedChecked}
                onChange={(event) => {
                  setAnimatedChecked(event.currentTarget.checked);
                  setStatus(
                    `Animated checkbox: ${event.currentTarget.checked ? "checked" : "clear"}`,
                  );
                }}
              />
            </TestControl>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            className="taskmap-button-material-test__divider"
          />
          <aside className="taskmap-button-material-test__status" aria-live="polite">
            <strong>Interaction status</strong>
            <span>{status}</span>
            <small>All motion uses the shared C1 scheduler and reduced-motion boundary.</small>
          </aside>
        </div>
      </Panel>
    </section>
  );
}

function TestControl({
  children,
  label,
}: {
  readonly children: React.ReactNode;
  readonly label: string;
}) {
  return (
    <div className="taskmap-button-material-test__control">
      <span className="taskmap-ui-lab__muted">{label}</span>
      {children}
    </div>
  );
}
