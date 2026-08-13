import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "./hooks";
import { AppProviders } from "./AppProviders";
import AppShell from "./AppShell";
import { selectActiveApplicationBoundary } from "./selectors/applicationSelectors";
import { createAppStore } from "./store";

const prototypeTestState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("../ui/renderer-v2-prototype/RendererV2Prototype", () => ({
  RendererV2Prototype: () => {
    if (prototypeTestState.shouldFail) throw new Error("Renderer V2 prototype failure");
    return <div>Renderer V2 Prototype</div>;
  },
}));

afterEach(() => {
  cleanup();
  prototypeTestState.shouldFail = false;
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders the canonical Renderer V2 prototype", () => {
    render(<AppShell />);

    expect(screen.getByText("Renderer V2 Prototype")).toBeInTheDocument();
  });

  it("initializes the Redux provider", () => {
    const store = createAppStore();

    function BoundaryProbe() {
      const boundary = useAppSelector(selectActiveApplicationBoundary);
      return <span>{boundary}</span>;
    }

    render(
      <AppProviders store={store}>
        <BoundaryProbe />
      </AppProviders>,
    );

    expect(screen.getByText("renderer-v2")).toBeInTheDocument();
  });

  it("contains Renderer V2 failures inside the application error boundary", () => {
    prototypeTestState.shouldFail = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    try {
      render(<AppShell />);
    } finally {
      window.removeEventListener("error", preventExpectedError);
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
