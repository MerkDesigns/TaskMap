import { IconBolt, IconCheck, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { useState } from "react";
import type { MaterialCompositorPresentationPublisher } from "../materials/materialCompositorPresentation";
import { MotionProvider } from "../motion/MotionProvider";
import { ReducedMotionProvider, useSystemReducedMotion } from "../motion/reducedMotionPreference";
import {
  Badge,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  Divider,
  Field,
  IconButton,
  Inline,
  Panel,
  Progress,
  RadioGroup,
  SearchField,
  SegmentedControl,
  Select,
  Slider,
  Spinner,
  Stack,
  StatusDot,
  Switch,
  Tabs,
  TextArea,
  TextField,
  ToggleButton,
} from "../primitives";
import "../theme/theme.css";
import { AcrylicCompositorPlayground } from "./AcrylicCompositorPlayground";
import { ButtonMaterialTests } from "./ButtonMaterialTests";
import "./DevelopmentUiLab.css";

const standardItems = [
  { value: "controls", label: "Controls" },
  { value: "materials", label: "Materials" },
  { value: "disabled", label: "Disabled", disabled: true },
] as const;

export interface DevelopmentUiLabProps {
  readonly presentation: MaterialCompositorPresentationPublisher;
}

export function DevelopmentUiLab({ presentation }: DevelopmentUiLabProps) {
  const systemReducedMotion = useSystemReducedMotion();
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean | null>(null);
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion;
  return (
    <ReducedMotionProvider override={reducedMotionOverride}>
      <MotionProvider>
        <UiLabContent
          presentation={presentation}
          reducedMotion={reducedMotion}
          reducedMotionOverride={reducedMotionOverride}
          setReducedMotionOverride={setReducedMotionOverride}
          systemReducedMotion={systemReducedMotion}
        />
      </MotionProvider>
    </ReducedMotionProvider>
  );
}

interface UiLabContentProps {
  readonly presentation: MaterialCompositorPresentationPublisher;
  readonly reducedMotion: boolean;
  readonly reducedMotionOverride: boolean | null;
  readonly setReducedMotionOverride: (value: boolean | null) => void;
  readonly systemReducedMotion: boolean;
}

function UiLabContent({
  presentation,
  reducedMotion,
  reducedMotionOverride,
  setReducedMotionOverride,
  systemReducedMotion,
}: UiLabContentProps) {
  const [standardTab, setStandardTab] = useState("controls");
  const [toggle, setToggle] = useState(true);
  const [checked, setChecked] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [radio, setRadio] = useState("comfortable");
  const [select, setSelect] = useState("local");
  const [viewMode, setViewMode] = useState("actual");

  return (
    <main
      className="taskmap-target-theme taskmap-ui-lab"
      data-taskmap-ui-lab="development-only"
      data-reduced-motion={reducedMotion}
      data-motion-source={reducedMotionOverride === null ? "system" : "simulation"}
    >
      <header className="taskmap-ui-lab__header">
        <div>
          <span className="taskmap-ui-lab__eyebrow">Phase 4.5C1 · development only</span>
          <h1>TaskMap UI Lab</h1>
          <p>Reusable primitives, materials, interaction states, and shared motion.</p>
        </div>
        <Inline gap="small">
          <Button className="taskmap-ui-lab__focus-target" size="compact" variant="ghost">
            Keyboard focus: press Tab
          </Button>
          <Badge tone={systemReducedMotion ? "warning" : "success"}>
            System reduced motion: {systemReducedMotion ? "on" : "off"}
          </Badge>
          <Switch
            label="Simulate reduced motion"
            checked={reducedMotion}
            onChange={(event) => setReducedMotionOverride(event.currentTarget.checked)}
          />
          {reducedMotionOverride === null ? null : (
            <Button size="compact" variant="ghost" onClick={() => setReducedMotionOverride(null)}>
              Use system
            </Button>
          )}
          <IconButton icon={<IconX size={18} />} aria-label="Close example" />
        </Inline>
      </header>

      <div className="taskmap-ui-lab__content">
        <AcrylicCompositorPlayground presentation={presentation} />

        <section className="taskmap-ui-lab__section">
          <h2>Material surfaces</h2>
          <div className="taskmap-ui-lab__surface-grid">
            <MaterialSample material="acrylic-large" title="Acrylic Large" />
            <MaterialSample material="acrylic-small" title="Acrylic Small" />
            <MaterialSample material="cutout" title="Cutout" />
            <MaterialSample material="opaque" title="Opaque" />
          </div>
        </section>

        <ButtonMaterialTests />

        <div className="taskmap-ui-lab__columns">
          <section className="taskmap-ui-lab__section">
            <h2>Buttons and selection</h2>
            <Panel material="acrylic-large">
              <Stack gap="large">
                <Inline>
                  <Button variant="primary" leadingIcon={<IconPlus size={16} />}>
                    Primary
                  </Button>
                  <Button>Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button disabled>Disabled</Button>
                  <IconButton icon={<IconBolt size={18} />} aria-label="Run action" />
                  <ToggleButton pressed={toggle} onClick={() => setToggle(!toggle)}>
                    Toggle
                  </ToggleButton>
                </Inline>
                <ButtonGroup label="Alignment examples">
                  <Button size="compact">Left</Button>
                  <Button size="compact">Center</Button>
                  <Button size="compact">Right</Button>
                </ButtonGroup>
                <SegmentedControl
                  label="View mode"
                  value={viewMode}
                  onValueChange={setViewMode}
                  items={[
                    { value: "fit", label: "Fit" },
                    { value: "actual", label: "Actual" },
                    { value: "presentation", label: "Present" },
                  ]}
                />
                <Divider />
                <Inline>
                  <Checkbox
                    label="Checkbox"
                    checked={checked}
                    onChange={(event) => setChecked(event.currentTarget.checked)}
                  />
                  <Switch
                    label="Private"
                    checked={privateMode}
                    onChange={(event) => setPrivateMode(event.currentTarget.checked)}
                  />
                </Inline>
                <RadioGroup
                  label="Density"
                  name="ui-lab-density"
                  value={radio}
                  onValueChange={setRadio}
                  items={[
                    { value: "compact", label: "Compact" },
                    { value: "comfortable", label: "Comfortable" },
                    { value: "roomy", label: "Roomy", disabled: true },
                  ]}
                />
                <Slider aria-label="Example slider" min={0} max={100} defaultValue={58} />
              </Stack>
            </Panel>
          </section>

          <section className="taskmap-ui-lab__section">
            <h2>Forms</h2>
            <Panel material="acrylic-large">
              <Stack gap="large">
                <Field label="Name" description="A reusable labeled field.">
                  <TextField defaultValue="Local canvas" />
                </Field>
                <Field label="Search">
                  <SearchField
                    placeholder="Search controls"
                    prefixSlot={<IconSearch size={15} />}
                  />
                </Field>
                <Field label="Storage">
                  <Select
                    value={select}
                    onValueChange={setSelect}
                    options={[
                      { value: "local", label: "Local database" },
                      { value: "portable", label: "Portable database" },
                    ]}
                  />
                </Field>
                <Field label="Description" error="Example validation message">
                  <TextArea defaultValue="Focus-visible and validation share system styling." />
                </Field>
              </Stack>
            </Panel>
          </section>
        </div>

        <section className="taskmap-ui-lab__section">
          <h2>Navigation and status</h2>
          <Panel material="acrylic-large">
            <Stack gap="large">
              <Tabs
                label="Catalog views"
                items={standardItems}
                value={standardTab}
                onValueChange={setStandardTab}
              />
              <Inline>
                <Badge>Neutral</Badge>
                <Badge tone="accent">Accent</Badge>
                <Badge tone="danger">Danger</Badge>
                <StatusDot tone="success" label="Ready" />
                <StatusDot tone="warning" label="Unsaved" />
                <Spinner label="Loading example" />
              </Inline>
              <Progress label="Deterministic progress" value={64} detail="64%" />
              <Progress label="Indeterminate progress" />
            </Stack>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function MaterialSample({
  material,
  title,
}: {
  material: "acrylic-large" | "acrylic-small" | "opaque" | "cutout";
  title: string;
}) {
  return (
    <Card material={material} radius={material === "cutout" ? 6 : undefined}>
      <strong>{title}</strong>
      <span>Real MaterialSurface strategy</span>
      <Badge tone="info">
        <IconCheck size={13} /> registered
      </Badge>
    </Card>
  );
}
