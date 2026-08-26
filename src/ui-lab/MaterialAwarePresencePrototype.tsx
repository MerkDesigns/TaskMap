import { useLayoutEffect, useRef } from "react";
import { Button } from "../ui/primitives/Button";
import { Slider } from "../ui/primitives/SelectionControls";
import { ContentLayer } from "./system/ContentLayer";
import { createPresenceMaterialStyle, PRESENCE_MATERIAL_CLASS } from "./system/materialPresence";
import {
  createPresenceMotionController,
  type PresenceMotionController,
} from "./system/presenceMotion";
import { Surface } from "./system/Surface";
import { VisualGroup, type VisualGroupHandle } from "./system/VisualGroup";
import "./materialAwarePresence.css";

const INSPECTION_PROGRESS = [1, 0.75, 0.5, 0.25, 0] as const;

export function MaterialAwarePresencePrototype() {
  const groupRef = useRef<VisualGroupHandle>(null);
  const controllerRef = useRef<PresenceMotionController | null>(null);
  const progressControlRef = useRef<HTMLInputElement>(null);
  const progressOutputRef = useRef<HTMLOutputElement>(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const controller = createPresenceMotionController(group, {
      onProgress(progress) {
        if (progressControlRef.current) progressControlRef.current.value = String(progress);
        if (progressOutputRef.current) progressOutputRef.current.value = progress.toFixed(3);
      },
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  return (
    <section className="taskmap-ui-lab-presence" aria-labelledby="material-aware-presence-title">
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Experimental presence behavior</span>
        <h2 id="material-aware-presence-title">Material-aware show / hide prototype</h2>
        <p>Glass parts and ordinary Content fade separately while the backdrop remains live.</p>
      </div>

      <div className="taskmap-ui-lab-presence__controls">
        <Button data-presence-action="show" onClick={() => controllerRef.current?.show()}>
          Show
        </Button>
        <Button data-presence-action="hide" onClick={() => controllerRef.current?.hide()}>
          Hide
        </Button>
        <Button data-presence-action="reverse" onClick={() => controllerRef.current?.reverse()}>
          Reverse
        </Button>

        <label className="taskmap-ui-lab-presence__progress-control">
          <span>
            Progress · <output ref={progressOutputRef}>1.000</output>
          </span>
          <Slider
            ref={progressControlRef}
            aria-label="Presence progress"
            defaultValue={1}
            min={0}
            max={1}
            step={0.01}
            onChange={(event) =>
              controllerRef.current?.setProgress(event.currentTarget.valueAsNumber)
            }
          />
        </label>

        <div className="taskmap-ui-lab-presence__inspection" aria-label="Inspection progress">
          {INSPECTION_PROGRESS.map((progress) => (
            <Button
              key={progress}
              data-presence-set={progress}
              size="compact"
              onClick={() => controllerRef.current?.setProgress(progress)}
            >
              {progress}
            </Button>
          ))}
        </div>
      </div>

      <div className="taskmap-ui-lab-presence__comparison">
        <div className="taskmap-ui-lab-presence__column">
          <span className="taskmap-ui-lab-presence__label">Unanimated reference</span>
          <PresenceComposition animated={false} />
        </div>

        <div className="taskmap-ui-lab-presence__column">
          <span className="taskmap-ui-lab-presence__label">Animated VisualGroup</span>
          <VisualGroup ref={groupRef} data-presence-group="prototype">
            <PresenceComposition animated />
          </VisualGroup>
        </div>
      </div>
    </section>
  );
}

function PresenceComposition({ animated }: { readonly animated: boolean }) {
  const presenceClassName = animated ? PRESENCE_MATERIAL_CLASS : undefined;

  return (
    <Surface
      className={["taskmap-ui-lab-presence__major", presenceClassName].filter(Boolean).join(" ")}
      data-presence-surface={animated ? "animated-major" : "reference-major"}
      material="major-glass"
      radius={23}
      style={animated ? createPresenceMaterialStyle("major-glass") : undefined}
    >
      <ContentLayer className="taskmap-ui-lab-presence__content">
        <strong>Major Surface</strong>
        <span>Ordinary ContentLayer</span>
      </ContentLayer>

      <div className="taskmap-ui-lab-presence__minor-grid">
        <Surface
          className={["taskmap-ui-lab-presence__minor", presenceClassName]
            .filter(Boolean)
            .join(" ")}
          data-presence-surface={animated ? "animated-minor-a" : "reference-minor-a"}
          material="minor-glass"
          radius={13.5}
          style={animated ? createPresenceMaterialStyle("minor-glass") : undefined}
        >
          <ContentLayer className="taskmap-ui-lab-presence__minor-content">
            <strong>Minor A</strong>
            <span>Nested glass</span>
          </ContentLayer>
        </Surface>

        <Surface
          className={["taskmap-ui-lab-presence__minor", presenceClassName]
            .filter(Boolean)
            .join(" ")}
          data-presence-surface={animated ? "animated-minor-b" : "reference-minor-b"}
          material="minor-glass"
          radius={13.5}
          style={animated ? createPresenceMaterialStyle("minor-glass") : undefined}
        >
          <ContentLayer className="taskmap-ui-lab-presence__minor-content">
            <strong>Minor B</strong>
            <span>Inherited progress</span>
          </ContentLayer>
        </Surface>
      </div>
    </Surface>
  );
}
