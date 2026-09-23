import { afterEach, expect, it, vi } from "vitest";
import { tauriWindowCloseClient } from "./tauriWindowCloseClient";

const native = vi.hoisted(() => ({ invoke: vi.fn(), destroy: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke: native.invoke }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ destroy: native.destroy }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("uses native geometry persistence before destroying the product window", async () => {
  vi.stubEnv("MODE", "development");
  await tauriWindowCloseClient.destroy();
  expect(native.invoke).toHaveBeenCalledWith("app_destroy_main_window");
  expect(native.destroy).not.toHaveBeenCalled();
});

it("does not bypass a rejected native close", async () => {
  vi.stubEnv("MODE", "development");
  native.invoke.mockRejectedValueOnce(new Error("close failed"));
  await expect(tauriWindowCloseClient.destroy()).rejects.toThrow("close failed");
  expect(native.destroy).not.toHaveBeenCalled();
});

it.each(["storage-preview", "ui-lab"])("keeps %s storage-free", async (mode) => {
  vi.stubEnv("MODE", mode);
  await tauriWindowCloseClient.destroy();
  expect(native.invoke).not.toHaveBeenCalled();
  expect(native.destroy).toHaveBeenCalledOnce();
});
