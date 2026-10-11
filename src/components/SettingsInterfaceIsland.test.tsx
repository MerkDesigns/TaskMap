import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_CHROME_RADII } from "../platform/settings/preferenceContracts";
import { setWorkspaceRadii, useWorkspaceRadii } from "../ui/patterns/workspace/workspaceRadii";
import { SettingsInterfaceIsland } from "./SettingsInterfaceIsland";

afterEach(() => {
  cleanup();
  setWorkspaceRadii(null);
});

function AppliedRadius() {
  return <output data-testid="applied">{useWorkspaceRadii().sidePanel}</output>;
}

it("previews radius drags live and saves once on release", () => {
  const onRadiusChange = vi.fn();
  render(
    <>
      <SettingsInterfaceIsland radii={DEFAULT_CHROME_RADII} onRadiusChange={onRadiusChange} />
      <AppliedRadius />
    </>,
  );
  const slider = screen.getByRole("slider", { name: "Side panel" });
  fireEvent.change(slider, { target: { value: "24" } });
  fireEvent.change(slider, { target: { value: "26" } });
  expect(screen.getByTestId("applied").textContent).toBe("26");
  expect(screen.getByText("26px")).toBeInTheDocument();
  expect(onRadiusChange).not.toHaveBeenCalled();

  fireEvent.pointerUp(slider);
  expect(onRadiusChange).toHaveBeenCalledExactlyOnceWith("sidePanel", 26);
});
