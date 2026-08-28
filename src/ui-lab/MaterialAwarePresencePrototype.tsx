import { useRef, useState, type RefObject } from "react";
import { Button } from "../ui/primitives/Button";
import { Slider } from "../ui/primitives/SelectionControls";
import {
  Fade,
  FadeLift,
  FadeSlide,
  Lift,
  SlideLeft,
  type PresenceEffects,
} from "./system/presenceController";
import { Surface } from "./system/Surface";
import { useSurfacePresence, type SurfacePresenceControls } from "./system/useSurfacePresence";
import "./materialAwarePresence.css";

const INSPECTION_PROGRESS = [1, 0.999, 0.75, 0.5, 0.25, 0] as const;

const MOTION_DEMOS = [
  { id: "fade", label: "Fade only", effects: Fade },
  { id: "lift", label: "Lift only", effects: Lift },
  { id: "slide", label: "Slide only · left", effects: SlideLeft },
  { id: "fade-lift", label: "Fade + Lift", effects: FadeLift },
  { id: "fade-slide", label: "Fade + Slide", effects: FadeSlide },
] as const;

export function MaterialAwarePresencePrototype() {
  return (
    <section className="taskmap-ui-lab-presence" aria-labelledby="material-aware-presence-title">
      <div className="taskmap-ui-lab-prototype__heading">
        <span className="taskmap-ui-lab__eyebrow">Experimental presence behavior</span>
        <h2 id="material-aware-presence-title">Composable presence behaviors</h2>
        <p>Fade, Lift, and Slide share one timeline while owning independent output channels.</p>
      </div>

      <div className="taskmap-ui-lab-presence__demo-grid">
        {MOTION_DEMOS.map((demo) => (
          <MotionDemo key={demo.id} {...demo} />
        ))}
      </div>

      <FadeComparison />
    </section>
  );
}

function MotionDemo({
  effects,
  id,
  label,
}: {
  readonly effects: PresenceEffects;
  readonly id: string;
  readonly label: string;
}) {
  const surfaceRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLOutputElement>(null);
  const controls = useSurfacePresence(surfaceRef, {
    effects,
    contentTargets: () => (contentRef.current ? [contentRef.current] : []),
    onProgress(progress) {
      if (progressRef.current) progressRef.current.value = progress.toFixed(3);
    },
  });

  return (
    <article className="taskmap-ui-lab-presence__demo" data-motion-demo={id}>
      <div className="taskmap-ui-lab-presence__demo-heading">
        <h3>{label}</h3>
        <output ref={progressRef}>1.000</output>
      </div>
      <PresenceButtons controls={controls} id={id} />
      <Surface
        ref={surfaceRef}
        className="taskmap-ui-lab-presence__demo-surface"
        data-motion-surface={id}
        material="minor-glass"
        radius={13.5}
      >
        <div
          ref={contentRef}
          className="taskmap-ui-lab-presence__content taskmap-ui-lab-fade-content"
        >
          <strong>{label}</strong>
          <span>One Surface · one timeline</span>
        </div>
      </Surface>
    </article>
  );
}

function FadeComparison() {
  const [contentVersion, setContentVersion] = useState(1);
  const renderCountRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const surfaceRef = useRef<HTMLElement>(null);
  const majorContentRef = useRef<HTMLDivElement>(null);
  const minorContentARef = useRef<HTMLDivElement>(null);
  const minorContentBRef = useRef<HTMLDivElement>(null);
  const progressControlRef = useRef<HTMLInputElement>(null);
  const progressOutputRef = useRef<HTMLOutputElement>(null);
  renderCountRef.current += 1;

  const controls = useSurfacePresence(surfaceRef, {
    effects: Fade,
    contentTargets: () =>
      [majorContentRef.current, minorContentARef.current, minorContentBRef.current].filter(
        (content): content is HTMLDivElement => content !== null,
      ),
    onProgress(progress) {
      if (progressControlRef.current) progressControlRef.current.value = String(progress);
      if (progressOutputRef.current) progressOutputRef.current.value = progress.toFixed(3);
    },
    onComplete(endpoint) {
      if (sectionRef.current) sectionRef.current.dataset.presenceEndpoint = endpoint;
    },
  });

  return (
    <article
      ref={sectionRef}
      className="taskmap-ui-lab-presence__comparison-demo"
      data-fade-comparison="true"
      data-render-count={renderCountRef.current}
    >
      <div className="taskmap-ui-lab-presence__comparison-heading">
        <div>
          <span className="taskmap-ui-lab__eyebrow">Rendered fade comparison</span>
          <h3>Major Glass + ordinary Content + nested Minor Glass</h3>
        </div>
        <Button size="compact" onClick={() => setContentVersion((version) => version + 1)}>
          Change content
        </Button>
      </div>

      <div className="taskmap-ui-lab-presence__comparison-controls">
        <PresenceButtons controls={controls} id="comparison" />
        <label className="taskmap-ui-lab-presence__progress-control">
          <span>
            Progress · <output ref={progressOutputRef}>1.000</output>
          </span>
          <Slider
            ref={progressControlRef}
            aria-label="Fade comparison progress"
            defaultValue={1}
            min={0}
            max={1}
            onChange={(event) => controls.setProgress(Number(event.currentTarget.value))}
          />
        </label>
        <div className="taskmap-ui-lab-presence__inspection" aria-label="Inspection progress">
          {INSPECTION_PROGRESS.map((progress) => (
            <Button
              key={progress}
              data-fade-progress={progress}
              size="compact"
              onClick={() => controls.setProgress(progress)}
            >
              {progress}
            </Button>
          ))}
        </div>
      </div>

      <div className="taskmap-ui-lab-presence__comparison" data-capture-mode="comparison">
        <div className="taskmap-ui-lab-presence__column" data-capture-column="reference">
          <span className="taskmap-ui-lab-presence__label">
            Untouched static Material reference
          </span>
          <PresenceComposition contentVersion={contentVersion} />
        </div>

        <div className="taskmap-ui-lab-presence__column" data-capture-column="animated">
          <span className="taskmap-ui-lab-presence__label">Fade behavior on outer Surface</span>
          <PresenceComposition
            animatedRef={surfaceRef}
            animatedContentRefs={[majorContentRef, minorContentARef, minorContentBRef]}
            contentVersion={contentVersion}
          />
        </div>
      </div>
    </article>
  );
}

function PresenceButtons({
  controls,
  id,
}: {
  readonly controls: SurfacePresenceControls;
  readonly id: string;
}) {
  return (
    <div className="taskmap-ui-lab-presence__buttons">
      <Button size="compact" data-presence-show={id} onClick={controls.show}>
        Show
      </Button>
      <Button size="compact" data-presence-hide={id} onClick={controls.hide}>
        Hide
      </Button>
      <Button size="compact" data-presence-reverse={id} onClick={controls.reverse}>
        Reverse
      </Button>
    </div>
  );
}

function PresenceComposition({
  animatedRef,
  animatedContentRefs,
  contentVersion,
}: {
  readonly animatedRef?: RefObject<HTMLElement | null>;
  readonly animatedContentRefs?: readonly RefObject<HTMLDivElement | null>[];
  readonly contentVersion: number;
}) {
  const animated = Boolean(animatedRef);
  return (
    <Surface
      ref={animatedRef}
      className="taskmap-ui-lab-presence__major"
      data-presence-surface={animated ? "animated-major" : "reference-major"}
      material="major-glass"
      radius={23}
    >
      <div
        ref={animatedContentRefs?.[0]}
        className={
          animated
            ? "taskmap-ui-lab-presence__content taskmap-ui-lab-fade-content"
            : "taskmap-ui-lab-presence__content"
        }
      >
        <strong>Major Surface</strong>
        <span>Ordinary Content · revision {contentVersion}</span>
      </div>

      <div className="taskmap-ui-lab-presence__minor-grid">
        <Surface
          className="taskmap-ui-lab-presence__minor"
          data-presence-surface={animated ? "animated-minor-a" : "reference-minor-a"}
          material="minor-glass"
          radius={13.5}
        >
          <div
            ref={animatedContentRefs?.[1]}
            className={
              animated
                ? "taskmap-ui-lab-presence__content taskmap-ui-lab-fade-content"
                : "taskmap-ui-lab-presence__content"
            }
          >
            <strong>Minor A</strong>
            <span>Nested glass</span>
          </div>
        </Surface>

        <Surface
          className="taskmap-ui-lab-presence__minor"
          data-presence-surface={animated ? "animated-minor-b" : "reference-minor-b"}
          material="minor-glass"
          radius={13.5}
        >
          <div
            ref={animatedContentRefs?.[2]}
            className={
              animated
                ? "taskmap-ui-lab-presence__content taskmap-ui-lab-fade-content"
                : "taskmap-ui-lab-presence__content"
            }
          >
            <strong>Minor B</strong>
            <span>Inherited Material progress</span>
          </div>
        </Surface>
      </div>
    </Surface>
  );
}
