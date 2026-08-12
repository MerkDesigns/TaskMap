import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "./hooks";
import { AppProviders } from "./AppProviders";
import AppShell from "./AppShell";
import { selectActiveApplicationBoundary } from "./selectors/applicationSelectors";
import { createAppStore } from "./store";

const canvasTestState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("../features/workspace-chrome/RendererV2ApplicationWorkspace", () => ({
  RendererV2ApplicationWorkspace: () => {
    if (canvasTestState.shouldFail) throw new Error("Renderer V2 canvas failure");
    return <div>Renderer V2 application workspace</div>;
  },
}));

vi.mock("../ui/materials/MaterialCompositorProvider", () => ({
  MaterialCompositorProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../features/phase2-database/DevelopmentPhase2Entry", () => ({
  DevelopmentPhase2Entry: () => null,
}));

afterEach(() => {
  cleanup();
  canvasTestState.shouldFail = false;
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders the production Renderer V2 application workspace", () => {
    render(<AppShell />);

    expect(screen.getByText("Renderer V2 application workspace")).toBeInTheDocument();
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
    canvasTestState.shouldFail = true;
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
