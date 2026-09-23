import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  create: vi.fn(),
  close: null as null | (() => Promise<unknown>),
}));
vi.mock("./createTauriDatabaseSessionController", () => ({
  createTauriDatabaseSessionController: fixture.create,
}));
vi.mock("../../features/database-entry/DatabaseSessionGate", () => ({
  DatabaseSessionGate: () => <div>Admitted session</div>,
}));
vi.mock("../../legacy/RetainedCanvasApplication", () => ({
  RetainedCanvasApplication: () => null,
}));
vi.mock("../../features/database-entry/DatabaseWindowChrome", () => ({
  DatabaseWindowChrome: ({ prepareClose }: { prepareClose: () => Promise<unknown> }) => {
    fixture.close = prepareClose;
    return null;
  },
}));
afterEach(() => {
  cleanup();
  vi.resetModules();
  fixture.create.mockReset();
});

it("StrictMode creates one runtime and window close flushes without closing the keeper session", async () => {
  const flush = vi.fn().mockResolvedValue({ ok: true, value: undefined });
  const cancel = vi.fn();
  fixture.create.mockResolvedValue({
    ok: true,
    value: {
      controller: {
        getSnapshot: () => ({ phase: "unlocked", busy: false }),
        prepareWindowClose: flush,
        cancel,
      },
    },
  });
  const { DatabaseApplication } = await import("./DatabaseApplication");
  render(
    <StrictMode>
      <DatabaseApplication />
    </StrictMode>,
  );
  await screen.findByText("Admitted session");
  expect(fixture.create).toHaveBeenCalledTimes(1);
  await fixture.close?.();
  expect(flush).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
});

it("window close cancels an in-progress admission", async () => {
  const cancel = vi.fn().mockResolvedValue({ ok: true, value: undefined });
  fixture.create.mockResolvedValue({
    ok: true,
    value: {
      controller: {
        getSnapshot: () => ({ phase: "unknown", busy: true }),
        cancel,
      },
    },
  });
  const { DatabaseApplication } = await import("./DatabaseApplication");
  render(<DatabaseApplication />);
  await screen.findByText("Admitted session");
  await fixture.close?.();
  expect(cancel).toHaveBeenCalledTimes(1);
});

it("failed boot shows an actionable error and still permits window close", async () => {
  fixture.create.mockResolvedValue({ ok: false });
  const { DatabaseApplication } = await import("./DatabaseApplication");
  render(<DatabaseApplication />);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("could not start"));
  await expect(fixture.close?.()).resolves.toMatchObject({ ok: true });
});
