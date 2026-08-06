import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationErrorBoundary } from "./ApplicationErrorBoundary";
import type { ApplicationErrorReporter } from "./applicationErrorReporter";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ApplicationErrorBoundary", () => {
  it("renders normal children unchanged", () => {
    const reporter: ApplicationErrorReporter = { report: vi.fn() };

    render(
      <ApplicationErrorBoundary reporter={reporter}>
        <p>New architecture content</p>
      </ApplicationErrorBoundary>,
    );

    expect(screen.getByText("New architecture content")).toBeInTheDocument();
    expect(reporter.report).not.toHaveBeenCalled();
  });

  it("renders a deterministic fallback and reports a failing child", () => {
    const failure = new Error("sensitive failure detail");
    const reporter: ApplicationErrorReporter = { report: vi.fn() };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", preventExpectedError);

    function FailingChild(): never {
      throw failure;
    }

    try {
      render(
        <ApplicationErrorBoundary reporter={reporter}>
          <FailingChild />
        </ApplicationErrorBoundary>,
      );
    } finally {
      window.removeEventListener("error", preventExpectedError);
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "TaskMap could not open this part of the application.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("sensitive failure detail")).not.toBeInTheDocument();
    expect(reporter.report).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "new-architecture",
        error: failure,
      }),
    );
  });
});
