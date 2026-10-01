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
import { MODAL_PRESENCE_TIMING } from "./modalMotion";

afterEach(cleanup);

describe("ModalPresence", () => {
  it("keeps the accepted enter/exit durations and curves", () => {
    expect(MODAL_PRESENCE_TIMING.enter.durationMs).toBe(216);
    expect(MODAL_PRESENCE_TIMING.exit.durationMs).toBe(120);
    expect(MODAL_PRESENCE_TIMING.enter.easing(0.5)).toBeCloseTo(0.875, 10);
    expect(MODAL_PRESENCE_TIMING.exit.easing(0.5)).toBeCloseTo(0.5, 10);
  });

  it("material-fades native glass through exit without ancestor opacity or cached masks", () => {
    const harness = createPresenceHarness(false);
    const exitMasks: number[][] = [];
    const exitStyles: Array<{ opacity: string; transform: string; presence: string }> = [];
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
              presence: presenceValue(current),
            });
          }}
        >
          <TestAcrylicGroup />
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(true));
    const group = presenceGroup();
    expect(presenceValue(group)).toBe("0");
    expect(group.style.opacity).toBe("");
    // Plain material fade: the group never moves or scales.
    expect(group.style.transform).toBe("");
    expect(scrim().style.opacity).toBe("0");
    expect(maskOpacities(harness)).toEqual([]);
    expect(harness.scheduler.getSnapshot().subscriberCount).toBe(1);

    // The first frame starts the presence clock (zero delta); the second one advances it.
    act(() => harness.driver.fire());
    act(() => harness.driver.fire());
    expect(harness.notifyGeometry).not.toHaveBeenCalled();
    expect(Number(presenceValue(group))).toBeGreaterThan(0);
    expect(group.style.opacity).toBe("");
    act(() => harness.driver.flush());
    expect(presenceValue(group)).toBe("");
    expect(group.style.transform).toBe("");
    expect(scrim().style.opacity).toBe("1");
    expect(group).toHaveAttribute("data-motion-state", "open");
    expect(maskOpacities(harness)).toEqual([]);
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(harness.driver.fire()).toBe(false);

    rerender(view(false));
    expect(group).toHaveAttribute("data-motion-state", "closing");
    act(() => harness.driver.fire());
    act(() => harness.driver.fire());
    expect(Number(presenceValue(group))).toBeLessThan(1);
    expect(group.style.opacity).toBe("");
    act(() => harness.driver.flush());
    expect(exitMasks).toEqual([[]]);
    expect(exitStyles).toEqual([{ opacity: "", transform: "", presence: "0" }]);
    expect(screen.queryByRole("dialog", { name: "Motion dialog" })).not.toBeInTheDocument();
    expect(harness.scheduler.getSnapshot()).toEqual({ subscriberCount: 0, framePending: false });
    expect(harness.notifyGeometry).not.toHaveBeenCalled();
    harness.dispose();
  });

  it("fades only glass-free content, including content mounted mid-animation", async () => {
    const harness = createPresenceHarness(false);
    const view = (late: boolean) => (
      <HarnessProviders harness={harness}>
        <ModalPresence open>
          <ModalDialog width={360} role="dialog" aria-label="Motion dialog">
            <p>Body</p>
            <MaterialSurface material="acrylic-small" radius={8} data-testid="island">
              <span>Island label</span>
            </MaterialSurface>
            {late ? <p>Late</p> : null}
          </ModalDialog>
        </ModalPresence>
      </HarnessProviders>
    );
    const { rerender } = render(view(false));
    const marked = "data-material-presence-content";
    expect(screen.getByText("Body")).toHaveAttribute(marked);
    expect(screen.getByText("Island label")).toHaveAttribute(marked);
    expect(screen.getByTestId("island")).not.toHaveAttribute(marked);
    expect(screen.getByRole("dialog")).not.toHaveAttribute(marked);

    act(() => harness.driver.fire());
    rerender(view(true));
    await act(async () => {});
    expect(screen.getByText("Late")).toHaveAttribute(marked);
    act(() => harness.driver.flush());
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
    act(() => harness.driver.fire());
    const closingPresence = Number(presenceValue(presenceGroup()));
    expect(closingPresence).toBeLessThan(1);

    rerender(view(true));
    expect(document.querySelectorAll("[data-taskmap-modal-presence-level='root']")).toHaveLength(1);
    expect(Number(presenceValue(presenceGroup()))).toBe(closingPresence);
    expect(harness.scheduler.getSnapshot().subscriberCount).toBe(1);
    act(() => harness.driver.flush());
    expect(presenceValue(presenceGroup())).toBe("");
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
    expect(presenceValue(presenceGroup())).toBe("");
    expect(presenceGroup().style.opacity).toBe("");
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

  it("composes root and nested presence for every scheduler ordering and motion combination", () => {
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

function scrim() {
  return document.querySelector(".taskmap-modal-scrim") as HTMLDivElement;
}

function presenceValue(element: HTMLElement) {
  return element.style.getPropertyValue("--taskmap-material-presence-progress");
}

function inlineNumber(element: HTMLElement, property: string) {
  return Number(element.style.getPropertyValue(property) || 1);
}

function rootGroupOpacity() {
  return inlineNumber(presenceGroupByLevel("root"), "--taskmap-material-presence-progress");
}

/** Mirrors the nested-group rule in ModalLayer.css: root presence x nested presence. */
function nestedEffectiveDomOpacity() {
  return (
    inlineNumber(presenceGroupByLevel("root"), "--taskmap-modal-root-presence") *
    inlineNumber(presenceGroupByLevel("nested"), "--taskmap-modal-nested-presence")
  );
}

/** Effective material presence for a surface; group opacity must never be used. */
function effectivePresenceOpacity(testId: string): number {
  let current = screen.getByTestId(testId).parentElement;
  while (current) {
    if (current.classList.contains("taskmap-modal-presence-group")) {
      expect(current.style.opacity).toBe("");
      return current.dataset.taskmapModalPresenceLevel === "nested"
        ? nestedEffectiveDomOpacity()
        : rootGroupOpacity();
    }
    current = current.parentElement;
  }
  return 1;
}
