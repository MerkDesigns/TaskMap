import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSessionGate } from "./DatabaseSessionGate";
import { entrySetup, openEntry, submitPassword } from "./databaseEntryTestSupport";
import { success } from "../../app/database/databaseSessionTestSupport";
import { unlockedSession } from "../../app/workspace/workspaceTestSupport";
import {
  beginWorkspaceOutro,
  getWorkspaceIntroPhase,
  registerWorkspaceIntroCanvas,
  useWorkspaceIntroArrival,
} from "../../ui/patterns/workspace/workspaceIntro";

afterEach(cleanup);

/** Mounts its canvas late, like the lazily loaded development workbench. */
function Workspace({ onArrive }: { readonly onArrive: () => void }) {
  useEffect(() => {
    let unregister = () => {};
    const timer = setTimeout(() => (unregister = registerWorkspaceIntroCanvas()), 800);
    return () => {
      clearTimeout(timer);
      unregister();
    };
  }, []);
  useWorkspaceIntroArrival(onArrive);
  return <div data-testid="workspace">Workspace</div>;
}

it("keeps the unlock screen over the mounted workspace, then reveals it and lets the chrome arrive", async () => {
  const setup = entrySetup();
  const onArrive = vi.fn();
  render(
    <DatabaseSessionGate runtime={setup.runtime}>
      <Workspace onArrive={onArrive} />
    </DatabaseSessionGate>,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "New database" })).toBeEnabled());
  await openEntry();
  submitPassword();

  await screen.findByTestId("workspace");
  // Same render as the workspace's first frame: the unlock screen is still on top.
  const entry = document.querySelector(".taskmap-database-entry")!;
  expect(entry).toHaveAttribute("data-unlock-reveal");
  expect(getWorkspaceIntroPhase()).not.toBe("idle");

  // Still covered/revealing past the 1 s slow-loading threshold, yet the panel content stays
  // frozen: no status or Cancel swaps in mid-dissolve.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(document.querySelector(".taskmap-database-entry")).not.toBeNull();
  expect(screen.queryByText(/Loading preferences/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Cancel opening" })).toBeNull();
  await waitFor(() => expect(onArrive).toHaveBeenCalledOnce(), { timeout: 2000 });
  await waitFor(() => expect(document.querySelector(".taskmap-database-entry")).toBeNull(), {
    timeout: 2000,
  });
  expect(screen.getByTestId("workspace")).toBeInTheDocument();
  expect(getWorkspaceIntroPhase()).toBe("idle");
});

it("plays the lock animation over the unlocked workspace, then locks onto the same screen", async () => {
  const setup = entrySetup();
  render(
    <DatabaseSessionGate runtime={setup.runtime}>
      <Workspace onArrive={() => {}} />
    </DatabaseSessionGate>,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "New database" })).toBeEnabled());
  await openEntry();
  submitPassword();
  await waitFor(() => expect(document.querySelector(".taskmap-database-entry")).toBeNull(), {
    timeout: 3000,
  });

  let covered = false;
  const outro = beginWorkspaceOutro().then(() => (covered = true));
  await waitFor(() =>
    expect(document.querySelector(".taskmap-database-entry")).toHaveAttribute(
      "data-unlock-reveal",
      "concealing",
    ),
  );
  // Still unlocked under the cover until the animation has settled.
  expect(screen.getByTestId("workspace")).toBeInTheDocument();
  expect(setup.controller.getSnapshot().phase).toBe("unlocked");
  await act(() => outro);
  expect(covered).toBe(true);
  await act(() => setup.controller.lock());
  expect(screen.queryByTestId("workspace")).toBeNull();
  expect(document.querySelector(".taskmap-database-entry")).not.toHaveAttribute(
    "data-unlock-reveal",
  );
  expect(screen.getByLabelText("Password *")).toBeInTheDocument();
  expect(getWorkspaceIntroPhase()).toBe("idle");
});

it("opens straight into a session that is already unlocked, without the unlock screen", async () => {
  const setup = entrySetup();
  setup.client.getSessionStatus.mockResolvedValue(success(unlockedSession));
  const onArrive = vi.fn();
  render(
    <DatabaseSessionGate runtime={setup.runtime}>
      <Workspace onArrive={onArrive} />
    </DatabaseSessionGate>,
  );

  await screen.findByTestId("workspace");
  expect(document.querySelector(".taskmap-database-entry")).toBeNull();
  expect(screen.queryByText("Enter password")).toBeNull();
  // Arrives once the (late-mounting) canvas is there, so arrival listeners have subscribed.
  await waitFor(() => expect(onArrive).toHaveBeenCalledOnce(), { timeout: 2000 });
  expect(getWorkspaceIntroPhase()).toBe("idle");
});
