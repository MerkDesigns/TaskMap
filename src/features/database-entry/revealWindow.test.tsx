import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSessionGate } from "./DatabaseSessionGate";
import { entrySetup } from "./databaseEntryTestSupport";

const reveal = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../platform/window/tauriWindowChromeClient", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  revealCurrentWindow: reveal,
}));

afterEach(() => {
  cleanup();
  reveal.mockClear();
});

it("shows the hidden window once, after the entry panel has painted", async () => {
  const setup = entrySetup();
  render(
    <DatabaseSessionGate runtime={setup.runtime}>
      <div>Workspace</div>
    </DatabaseSessionGate>,
  );

  await waitFor(() => expect(screen.getByRole("button", { name: "New database" })).toBeEnabled());
  await waitFor(() => expect(reveal).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(reveal).toHaveBeenCalledOnce();
});
