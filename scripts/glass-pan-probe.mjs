/**
 * Manual development-WebView probe; never imported by the application.
 * rAF callback pacing is NOT rendered FPS. Invoke through the local Tauri inspection bridge.
 * Does not load documents or commit a gesture; every simulated pan ends with pointercancel.
 */
export async function profileGlassPan({ frames = 300, pan = true } = {}) {
  if (!Number.isInteger(frames) || frames < 30 || frames > 1200) {
    throw new RangeError("Use 30–1200 frames per bounded probe");
  }
  const { document, Element, PointerEvent, CanvasRenderingContext2D, requestAnimationFrame } =
    globalThis;
  const stage = document.querySelector("[data-stage]");
  const world = document.querySelector("[data-grid-style]");
  if (!stage || !world) throw new Error("Open the production workspace before profiling");
  const frame = () => new Promise(requestAnimationFrame);
  const transform = () => globalThis.getComputedStyle(world).transform;
  const initialTransform = transform();
  const pointerId = 891;
  const send = (type, x) =>
    stage.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        button: 1,
        buttons: 4,
        clientX: x,
        clientY: 100,
      }),
    );
  const captureKeys = ["setPointerCapture", "releasePointerCapture", "hasPointerCapture"];
  const captureDescriptors = captureKeys.map((key) => Object.getOwnPropertyDescriptor(stage, key));
  const rectangle = Element.prototype.getBoundingClientRect;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  let materialReads = 0;
  let rimDraws = 0;
  const intervals = [];
  const inputWork = [];
  let moved = false;
  let initialFrame;
  try {
    // Synthetic events have no OS pointer capture. Scope the shim to this stage only.
    stage.setPointerCapture = () => {};
    stage.releasePointerCapture = () => {};
    stage.hasPointerCapture = () => true;
    if (pan) send("pointerdown", 900);
    // Exclude activation/layout settlement from the steady-state counters.
    for (let i = 0; i < 12; i++) await frame();
    Element.prototype.getBoundingClientRect = function () {
      if (this.matches("[data-material]")) materialReads++;
      return rectangle.call(this);
    };
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.classList.contains("taskmap-material-native-glass__rim-canvas")) rimDraws++;
      return clear.apply(this, args);
    };
    initialFrame = await frame();
    for (let i = 0; i < frames; i++) {
      const nextFrame = await frame();
      intervals.push(nextFrame - initialFrame);
      initialFrame = nextFrame;
      const start = performance.now();
      if (pan) send("pointermove", 900 + 90 * Math.sin((i / frames) * 2 * Math.PI));
      inputWork.push(performance.now() - start);
    }
    moved = transform() !== initialTransform;
  } finally {
    Element.prototype.getBoundingClientRect = rectangle;
    CanvasRenderingContext2D.prototype.clearRect = clear;
    try {
      if (pan) send("pointercancel", 900);
    } finally {
      captureKeys.forEach((key, index) => {
        if (captureDescriptors[index]) Object.defineProperty(stage, key, captureDescriptors[index]);
        else delete stage[key];
      });
    }
  }
  for (let i = 0; i < 12; i++) await frame();
  return {
    kind: "development-callback-pacing-not-rendered-fps",
    frames,
    pan,
    moved,
    cameraRestored: transform() === initialTransform,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    viewport: [globalThis.innerWidth, globalThis.innerHeight],
    dpr: globalThis.devicePixelRatio,
    frameIntervalsMs: summarize(intervals),
    inputDispatchMs: summarize(inputWork),
    steadyMaterialRectangleReads: materialReads,
    steadyRimDraws: rimDraws,
  };
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const rounded = (value) => Math.round(value * 1000) / 1000;
  return {
    mean: rounded(values.reduce((a, b) => a + b, 0) / values.length),
    p95: rounded(sorted[Math.ceil(sorted.length * 0.95) - 1]),
    max: rounded(sorted.at(-1)),
    over16_67ms: values.filter((value) => value > 16.67).length,
  };
}
