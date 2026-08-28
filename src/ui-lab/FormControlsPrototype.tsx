import { IconSettings } from "@tabler/icons-react";
import { useState } from "react";
import { IconButton } from "../ui/primitives/Button";
import { Field } from "../ui/primitives/Field";
import { SearchField, Select, TextArea, TextField } from "../ui/primitives/FormControls";
import { Checkbox, Slider } from "../ui/primitives/SelectionControls";
import { Tooltip } from "../ui/primitives/Tooltip";

export function FormControlsPrototype() {
  const [snappingEnabled, setSnappingEnabled] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(65);
  const [canvasName, setCanvasName] = useState("Project planning");
  const [notes, setNotes] = useState("Add notes for this canvas...");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("system");
  const [iconAction, setIconAction] = useState("Not clicked");

  return (
    <article className="taskmap-ui-lab-controls__sample taskmap-ui-lab-controls__form-sample">
      <ControlHeading />

      <div className="taskmap-ui-lab-controls__form-grid">
        <div className="taskmap-ui-lab-controls__check-samples">
          <Checkbox
            checked={snappingEnabled}
            label="Enable snapping"
            onChange={(event) => setSnappingEnabled(event.currentTarget.checked)}
          />
          <Checkbox disabled label="Unavailable option" />
        </div>

        <Field label={`Grid opacity: ${Math.round(gridOpacity)}%`}>
          <Slider
            aria-label="Grid opacity"
            min={0}
            max={100}
            value={gridOpacity}
            onChange={(event) => setGridOpacity(Number(event.currentTarget.value))}
          />
        </Field>

        <Field label="Canvas name">
          <TextField
            value={canvasName}
            onChange={(event) => setCanvasName(event.currentTarget.value)}
          />
        </Field>

        <Field label="Search canvases">
          <SearchField
            placeholder="Search canvases"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </Field>

        <Field label="Canvas notes" className="taskmap-ui-lab-controls__notes-field">
          <TextArea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} />
        </Field>

        <Field label="Theme">
          <Select
            aria-label="Theme"
            options={[
              { value: "system", label: "System" },
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
            ]}
            value={theme}
            onValueChange={setTheme}
          />
        </Field>

        <div className="taskmap-ui-lab-controls__icon-sample">
          <span>Icon button with tooltip</span>
          <Tooltip label="Open settings">
            <IconButton
              aria-label="Open settings example"
              icon={<IconSettings size={18} stroke={2} />}
              onClick={() => setIconAction("Settings requested")}
            />
          </Tooltip>
          <output className="taskmap-ui-lab-controls__status">{iconAction}</output>
        </div>
      </div>
    </article>
  );
}

function ControlHeading() {
  return (
    <header className="taskmap-ui-lab-controls__heading">
      <h3>Form controls</h3>
      <p>Current production inputs with local UI Lab state.</p>
    </header>
  );
}
