import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppSelector } from "./hooks";
import { AppProviders } from "./AppProviders";
import AppShell from "./AppShell";
import { selectActiveApplicationBoundary } from "./selectors/applicationSelectors";
import { createAppStore } from "./store";

vi.mock("../legacy/LegacyApplication", () => ({
  LegacyApplication: () => <div>Legacy application boundary</div>,
}));

vi.mock("../features/phase2-database/DevelopmentPhase2Entry", () => ({
  DevelopmentPhase2Entry: () => null,
}));

afterEach(cleanup);

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
});
