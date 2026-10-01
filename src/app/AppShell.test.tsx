import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "./AppShell";

const databaseTestState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("./database/DatabaseApplication", () => ({
  DatabaseApplicationFallback: () => <div role="alert">Database failure fallback</div>,
  DatabaseApplication: () => {
    if (databaseTestState.shouldFail) throw new Error("Database render failure");
    return <div>Database application boundary</div>;
  },
}));

afterEach(() => {
  cleanup();
  databaseTestState.shouldFail = false;
  vi.restoreAllMocks();
});

describe("AppShell", () => {
  it("renders the database application boundary", () => {
    render(<AppShell />);

    expect(screen.getByText("Database application boundary")).toBeInTheDocument();
  });

  it("contains production render failures at the top-level boundary", () => {
    databaseTestState.shouldFail = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    try {
      render(<AppShell />);
      expect(screen.getByRole("alert")).toHaveTextContent("Database failure fallback");
    } finally {
      window.removeEventListener("error", preventExpectedError);
    }
  });
});
