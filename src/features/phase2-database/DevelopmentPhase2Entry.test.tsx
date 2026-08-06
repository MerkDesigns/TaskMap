import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DevelopmentPhase2Entry } from "./DevelopmentPhase2Entry";

afterEach(cleanup);

describe("DevelopmentPhase2Entry", () => {
  it("does not render the harness when production mode disables it", () => {
    render(<DevelopmentPhase2Entry enabled={false} />);

    expect(screen.queryByText("Phase 2 encrypted database harness")).not.toBeInTheDocument();
  });
});
