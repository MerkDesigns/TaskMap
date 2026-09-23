import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { profileGlassPan } from "./glass-pan-probe.mjs";

const { document, Element, MouseEvent } = globalThis;

describe("manual development glass pan probe", () => {
  let stage;
  let world;
  let events;
  let rectangle;
  let clear;

  beforeEach(() => {
    document.body.innerHTML = "<main data-stage><div data-grid-style></div></main>";
    stage = document.querySelector("[data-stage]");
    world = document.querySelector("[data-grid-style]");
    events = [];
    world.style.transform = "translateX(0px)";
    let timestamp = 0;
    vi.stubGlobal("requestAnimationFrame", (callback) => {
      callback((timestamp += 16));
      return timestamp;
    });
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.stubGlobal(
      "CanvasRenderingContext2D",
      class {
        clearRect() {}
      },
    );
    rectangle = Element.prototype.getBoundingClientRect;
    clear = globalThis.CanvasRenderingContext2D.prototype.clearRect;
    for (const type of ["pointerdown", "pointermove", "pointercancel"]) {
      stage.addEventListener(type, (event) => {
        events.push(event.type);
        world.style.transform =
          event.type === "pointermove" ? `translateX(${event.clientX - 900}px)` : "translateX(0px)";
      });
    }
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = rectangle;
    globalThis.CanvasRenderingContext2D.prototype.clearRect = clear;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it.each([0, 29, 1201, 30.5])("rejects an unbounded/invalid sample count %s", async (frames) => {
    await expect(profileGlassPan({ frames })).rejects.toThrow(RangeError);
    expect(events).toEqual([]);
  });

  it("measures idle without dispatching a gesture", async () => {
    const result = await profileGlassPan({ frames: 30, pan: false });
    expect(result).toMatchObject({
      kind: "development-callback-pacing-not-rendered-fps",
      moved: false,
      cameraRestored: true,
      steadyMaterialRectangleReads: 0,
      steadyRimDraws: 0,
      frameIntervalsMs: { mean: 16, p95: 16, max: 16, over16_67ms: 0 },
    });
    expect(events).toEqual([]);
  });

  it("cancels pan and restores existing stage methods and global instrumentation", async () => {
    const originalCapture = vi.fn();
    stage.setPointerCapture = originalCapture;
    const result = await profileGlassPan({ frames: 30 });
    expect(result).toMatchObject({ moved: true, cameraRestored: true });
    expect(events[0]).toBe("pointerdown");
    expect(events.filter((event) => event === "pointermove")).toHaveLength(30);
    expect(events.at(-1)).toBe("pointercancel");
    expect(events).not.toContain("pointerup");
    expect(stage.setPointerCapture).toBe(originalCapture);
    expect(Object.hasOwn(stage, "releasePointerCapture")).toBe(false);
    expect(Object.hasOwn(stage, "hasPointerCapture")).toBe(false);
    expect(Element.prototype.getBoundingClientRect).toBe(rectangle);
    expect(globalThis.CanvasRenderingContext2D.prototype.clearRect).toBe(clear);
  });

  it("restores instrumentation and cancels when a sample fails", async () => {
    const dispatch = stage.dispatchEvent.bind(stage);
    vi.spyOn(stage, "dispatchEvent").mockImplementation((event) => {
      if (event.type === "pointermove") throw new Error("sample failed");
      return dispatch(event);
    });
    await expect(profileGlassPan({ frames: 30 })).rejects.toThrow("sample failed");
    expect(events.at(-1)).toBe("pointercancel");
    expect(Object.hasOwn(stage, "setPointerCapture")).toBe(false);
    expect(Element.prototype.getBoundingClientRect).toBe(rectangle);
    expect(globalThis.CanvasRenderingContext2D.prototype.clearRect).toBe(clear);
  });
});
