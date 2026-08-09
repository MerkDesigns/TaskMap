import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "./hooks";
import { AppProviders } from "./AppProviders";
import AppShell from "./AppShell";
import { selectActiveApplicationBoundary } from "./selectors/applicationSelectors";
import { createAppStore } from "./store";

const legacyTestState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("../legacy/LegacyApplication", () => ({
  LegacyApplication: () => {
    if (legacyTestState.shouldFail) throw new Error("Legacy render failure");
    return <div>Legacy application boundary</div>;
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
  legacyTestState.shouldFail = false;
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders the temporary legacy application boundary", () => {
    render(<AppShell />);

    expect(screen.getByText("Legacy application boundary")).toBeInTheDocument();
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

    expect(screen.getByText("legacy")).toBeInTheDocument();
  });

  it("does not intercept errors from inside LegacyApplication", () => {
    legacyTestState.shouldFail = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    try {
      expect(() => render(<AppShell />)).toThrow("Legacy render failure");
    } finally {
      window.removeEventListener("error", preventExpectedError);
    }
  });
});
