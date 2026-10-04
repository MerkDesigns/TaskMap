import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppUpdates } from "./useAppUpdates";

const updater = vi.hoisted(() => ({ check: vi.fn() }));

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.0.0") }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: updater.check }));

const options = (checkOnStartup: boolean, dismissedUpdateVersion?: string) => ({
  checkOnStartup,
  dismissedUpdateVersion,
  onDismissUpdateVersion: vi.fn(),
  saveCurrentData: vi.fn(async () => undefined),
  showToast: vi.fn(),
});

const update = { version: "2.0.0", currentVersion: "1.0.0", date: undefined, body: "Notes" };

beforeEach(() => {
  vi.clearAllMocks();
  updater.check.mockResolvedValue(update);
});
afterEach(cleanup);

describe("useAppUpdates", () => {
  it("checks once on startup and offers a newer version", async () => {
    const { result, rerender } = renderHook((props) => useAppUpdates(props), {
      initialProps: options(true),
    });

    await waitFor(() => expect(result.current.updateModalOpen).toBe(true));
    rerender(options(true));
    expect(updater.check).toHaveBeenCalledOnce();
    expect(result.current.availableUpdate?.version).toBe("2.0.0");
  });

  it("does not reopen the offer for a version the user dismissed", async () => {
    const { result } = renderHook(() => useAppUpdates(options(true, "2.0.0")));

    await waitFor(() => expect(result.current.availableUpdate?.version).toBe("2.0.0"));
    expect(result.current.updateModalOpen).toBe(false);
  });

  it("does not check on startup when told not to", async () => {
    renderHook(() => useAppUpdates(options(false)));

    await Promise.resolve();
    expect(updater.check).not.toHaveBeenCalled();
  });
});
