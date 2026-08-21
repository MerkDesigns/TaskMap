import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MaterialPlaneProvider } from "../../materials/MaterialPlane";
import { MaterialSurface } from "../../materials/MaterialSurface";
import {
  resolveMaterialSurfaceMaskOpacity,
  type MaterialSurfaceMaskOpacityGroup,
} from "../../materials/MaterialSurfaceRegistration";
import { ModalDialog } from "./ModalDialog";
import { ModalPresence } from "./ModalPresence";
import {
  createModalPresenceTestHarness as createPresenceHarness,
  ModalPresenceTestProviders as HarnessProviders,
} from "./modalPresenceTestHarness";
import { advanceModalMotion, MODAL_ENTER_FROM, MODAL_REST } from "./modalMotion";

afterEach(cleanup);

describe("ModalPresence", () => {
  it("uses exact accepted enter/exit states and durations", () => {
    const entering = advanceModalMotion(MODAL_ENTER_FROM, true, 90);
    expect(entering.settled).toBe(false);
    expect(entering.state.opacity).toBeGreaterThan(0);
    expect(entering.state.opacity).toBeLessThan(1);
    expect(advanceModalMotion(MODAL_ENTER_FROM, true, 180)).toEqual({
      state: { opacity: 1, translateY: 0, scale: 1, scrimOpacity: 1 },
      settled: true,
    });
    expect(advanceModalMotion(MODAL_REST, false, 120)).toEqual({
      state: { opacity: 0, translateY: 4, scale: 0.985, scrimOpacity: 0 },
      settled: true,
    });
  });

  it("retains native glass DOM through exit on one scheduler without cached masks", () => {
    const harness = createPresenceHarness(false);
    const exitMasks: number[][] = [];
    const exitStyles: Array<{ opacity: string; transform: string; willChange: string }> = [];
    const view = (open: boolean) => (
      <HarnessProviders harness={harness}>
        <ModalPresence
          open={open}
          onExitComplete={() => {
            exitMasks.push(
              harness.registry.getSnapshot().surfaces.map(({ maskOpacity }) => maskOpacity),
            );
            const current = presenceGroup();
            exitStyles.push({
              opacity: current.style.opacity,
              transform: current.style.transform,
              willChange: current.style.willChange,
            });
          }}
        >
          <TestAcrylicGroup />
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(true));
    const group = presenceGroup();
    expect(group.style.opacity).toBe("0");
    expect(group.style.transform).toBe("translate3d(0, 6px, 0) scale(0.98)");
    expect((document.querySelector(".taskmap-modal-scrim") as HTMLDivElement).style.opacity).toBe(
      "0",
    );
    expect(maskOpacities(harness)).toEqual([]);
    expect(harness.scheduler.getSnapshot().subscriberCount).toBe(1);

    const geometryAtStart = harness.notifyGeometry.mock.calls.length;
    act(() => harness.driver.fire());
    expect(harness.notifyGeometry).toHaveBeenCalledTimes(geometryAtStart + 1);
    expect(Number(group.style.opacity)).toBeGreaterThan(0);
    expect(maskOpacities(harness)).toEqual([]);
    act(() => harness.driver.flush());
    expect(group.style.opacity).toBe("1");
    expect(group.style.transform).toBe("translate3d(0, 0px, 0) scale(1)");
    expect(group.style.willChange).toBe("");
    expect(maskOpacities(harness)).toEqual([]);
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    const geometryAtRest = harness.notifyGeometry.mock.calls.length;
    expect(harness.driver.fire()).toBe(false);
    expect(harness.notifyGeometry).toHaveBeenCalledTimes(geometryAtRest);

    rerender(view(false));
    expect(screen.getByRole("dialog", { name: "Motion dialog" })).toBeInTheDocument();
    expect(group).toHaveAttribute("data-motion-state", "closing");
    act(() => harness.driver.fire());
    expect(maskOpacities(harness)).toEqual([]);
    act(() => harness.driver.flush());
    expect(exitMasks).toEqual([[]]);
    expect(exitStyles).toEqual([
      {
        opacity: "0",
        transform: "translate3d(0, 4px, 0) scale(0.985)",
        willChange: "",
      },
    ]);
    expect(screen.queryByRole("dialog", { name: "Motion dialog" })).not.toBeInTheDocument();
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(harness.driver.fire()).toBe(false);
    expect(harness.notifyGeometry).toHaveBeenCalled();
    harness.dispose();
  });

  it("retargets a reopen from the current exit state without duplicating presence", () => {
    const harness = createPresenceHarness(false);
    const view = (open: boolean) => (
      <HarnessProviders harness={harness}>
        <ModalPresence open={open}>
          <TestAcrylicGroup />
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(true));
    act(() => harness.driver.flush());
    rerender(view(false));
    act(() => harness.driver.fire());
    const closingOpacity = Number(presenceGroup().style.opacity);
    expect(closingOpacity).toBeLessThan(1);

    rerender(view(true));
    expect(document.querySelectorAll("[data-taskmap-modal-presence-level='root']")).toHaveLength(1);
    expect(Number(presenceGroup().style.opacity)).toBe(closingOpacity);
    expect(harness.scheduler.getSnapshot().subscriberCount).toBe(1);
    act(() => harness.driver.flush());
    expect(presenceGroup().style.opacity).toBe("1");
    expect(maskOpacities(harness)).toEqual([]);
    harness.dispose();
  });

  it("settles and removes immediately for reduced motion with no pending work", () => {
    const harness = createPresenceHarness(true);
    const view = (open: boolean) => (
      <HarnessProviders harness={harness}>
        <ModalPresence open={open}>
          <TestAcrylicGroup />
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(true));
    expect(presenceGroup().style.opacity).toBe("1");
    expect(maskOpacities(harness)).toEqual([]);
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    rerender(view(false));
    expect(screen.queryByRole("dialog", { name: "Motion dialog" })).not.toBeInTheDocument();
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    harness.dispose();
  });

  it("uses a local nested scrim without adding a root plane boundary or click dismissal", () => {
    const harness = createPresenceHarness(true);
    render(
      <HarnessProviders harness={harness}>
        <MaterialPlaneProvider plane="modal">
          <ModalPresence open placement="nested">
            <TestAcrylicGroup />
          </ModalPresence>
        </MaterialPlaneProvider>
      </HarnessProviders>,
    );
    expect(document.querySelectorAll(".taskmap-nested-modal-scrim")).toHaveLength(1);
    expect(document.querySelectorAll(".taskmap-modal-scrim")).toHaveLength(0);
    expect(presenceGroup()).toHaveAttribute("data-taskmap-modal-presence-level", "nested");
    fireEvent.click(document.querySelector(".taskmap-nested-modal-scrim") as HTMLDivElement);
    expect(screen.getByRole("dialog", { name: "Motion dialog" })).toBeInTheDocument();
    expect(harness.registry.getSnapshot().surfaces.every(({ plane }) => plane === "modal")).toBe(
      true,
    );
    harness.dispose();
  });

  it("composes root and nested opacity for every scheduler ordering and motion combination", () => {
    const rootOpacity = { current: 1 };
    const nestedOpacity = { current: 1 };
    const rootGroup: MaterialSurfaceMaskOpacityGroup = {
      localOpacityRef: rootOpacity,
      parent: null,
    };
    const nestedGroup: MaterialSurfaceMaskOpacityGroup = {
      localOpacityRef: nestedOpacity,
      parent: rootGroup,
    };
    rootOpacity.current = 0.4;
    nestedOpacity.current = 0.5;
    expect(resolveMaterialSurfaceMaskOpacity(nestedGroup)).toBeCloseTo(0.2, 10);
    rootOpacity.current = 1;
    nestedOpacity.current = 1;
    nestedOpacity.current = 0.5;
    rootOpacity.current = 0.4;
    expect(resolveMaterialSurfaceMaskOpacity(nestedGroup)).toBeCloseTo(0.2, 10);

    const harness = createPresenceHarness(false);
    const unrelated = (
      <MaterialSurface material="acrylic-small" data-testid="unrelated-surface">
        Unrelated
      </MaterialSurface>
    );
    const view = (rootOpen: boolean, nestedOpen: boolean) => (
      <HarnessProviders harness={harness}>
        {unrelated}
        <ModalPresence open={rootOpen}>
          <MaterialSurface material="acrylic-large" data-testid="root-surface">
            Root
          </MaterialSurface>
          <ModalPresence open={nestedOpen} placement="nested">
            <MaterialSurface material="acrylic-large" data-testid="nested-surface">
              Nested
            </MaterialSurface>
          </ModalPresence>
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(true, true));

    act(() => harness.driver.fire());
    expect(effectivePresenceOpacity("nested-surface")).toBeCloseTo(nestedEffectiveDomOpacity(), 10);
    expect(effectivePresenceOpacity("root-surface")).toBeCloseTo(rootGroupOpacity(), 10);
    expect(effectivePresenceOpacity("unrelated-surface")).toBe(1);
    act(() => harness.driver.flush());

    rerender(view(false, true));
    act(() => harness.driver.fire());
    expect(effectivePresenceOpacity("nested-surface")).toBeCloseTo(nestedEffectiveDomOpacity(), 10);
    expect(effectivePresenceOpacity("root-surface")).toBeCloseTo(rootGroupOpacity(), 10);
    expect(effectivePresenceOpacity("unrelated-surface")).toBe(1);
    const closingRootOpacity = rootGroupOpacity();
    rerender(view(true, true));
    expect(rootGroupOpacity()).toBe(closingRootOpacity);
    act(() => harness.driver.fire());
    expect(effectivePresenceOpacity("nested-surface")).toBeCloseTo(nestedEffectiveDomOpacity(), 10);
    act(() => harness.driver.flush());

    rerender(view(true, false));
    act(() => harness.driver.fire());
    expect(effectivePresenceOpacity("nested-surface")).toBeCloseTo(nestedEffectiveDomOpacity(), 10);
    expect(effectivePresenceOpacity("root-surface")).toBe(1);
    rerender(view(true, true));
    act(() => harness.driver.fire());
    expect(effectivePresenceOpacity("nested-surface")).toBeCloseTo(nestedEffectiveDomOpacity(), 10);
    act(() => harness.driver.flush());
    expect(effectivePresenceOpacity("nested-surface")).toBe(1);
    expect(effectivePresenceOpacity("unrelated-surface")).toBe(1);
    expect(harness.registry.getSnapshot().surfaces).toEqual([]);
    harness.dispose();
  });

  it("keeps native surface identity stable without cache work across mid-motion renders", () => {
    const harness = createPresenceHarness(false);
    const view = (revision: number, showLate: boolean) => (
      <HarnessProviders harness={harness}>
        <ModalPresence open>
          <ModalPresence open placement="nested">
            <MaterialSurface
              material="acrylic-large"
              data-testid="stable-surface"
              data-render-revision={revision}
            >
              Stable
            </MaterialSurface>
            {showLate ? (
              <MaterialSurface material="acrylic-small" data-testid="late-surface">
                Late
              </MaterialSurface>
            ) : null}
          </ModalPresence>
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(0, false));
    act(() => harness.driver.fire());
    const stableElement = screen.getByTestId("stable-surface");
    const revisionBeforeRender = harness.registry.getSnapshot().revision;

    rerender(view(1, false));
    expect(screen.getByTestId("stable-surface")).toBe(stableElement);
    expect(harness.registry.getSnapshot().revision).toBe(revisionBeforeRender);
    expect(stableElement).toHaveAttribute("data-material-strategy", "native-glass");
    expect(stableElement).not.toHaveAttribute("data-material-surface-id");

    rerender(view(2, true));
    expect(screen.getByTestId("late-surface")).toHaveAttribute(
      "data-material-strategy",
      "native-glass",
    );
    expect(harness.registry.getSnapshot().surfaces).toEqual([]);
    harness.dispose();
  });
});

function TestAcrylicGroup() {
  return (
    <ModalDialog width={360} role="dialog" aria-label="Motion dialog">
      <MaterialSurface material="acrylic-small" radius={8}>
        Island one
      </MaterialSurface>
      <MaterialSurface material="acrylic-small" radius={8}>
        Island two
      </MaterialSurface>
    </ModalDialog>
  );
}

function presenceGroup() {
  return document.querySelector(".taskmap-modal-presence-group") as HTMLDivElement;
}

function maskOpacities(harness: ReturnType<typeof createPresenceHarness>) {
  return harness.registry.getSnapshot().surfaces.map(({ maskOpacity }) => maskOpacity);
}

function presenceGroupByLevel(level: "root" | "nested") {
  return document.querySelector(`[data-taskmap-modal-presence-level='${level}']`) as HTMLDivElement;
}

function rootGroupOpacity() {
  return Number(presenceGroupByLevel("root").style.opacity);
}

function nestedEffectiveDomOpacity() {
  return rootGroupOpacity() * Number(presenceGroupByLevel("nested").style.opacity);
}

function effectivePresenceOpacity(testId: string): number {
  let opacity = 1;
  let current = screen.getByTestId(testId).parentElement;
  while (current) {
    if (current.classList.contains("taskmap-modal-presence-group")) {
      opacity *= Number(current.style.opacity || 1);
    }
    current = current.parentElement;
  }
  return opacity;
}
