import { expect, it, vi } from "vitest";
import { clearDatabaseResources, createDatabaseRuntimeResources } from "./databaseRuntimeResources";

it("fails closed before attachment and rejects replacing an established owner", async () => {
  const owner = createDatabaseRuntimeResources();
  expect(() => owner.purge()).toThrow("not attached");
  const resources = {
    flush: vi.fn(async () => ({ ok: true as const, value: undefined })),
    purge: vi.fn(),
    dispose: vi.fn(),
  };
  owner.attach(resources);
  await owner.flush();
  owner.purge();
  expect(resources.purge).toHaveBeenCalledOnce();
  expect(() => owner.attach(resources)).toThrow("already attached");
});

it("attempts every purge even when an earlier owner fails, then reports failure", () => {
  const media = vi.fn();
  const ui = vi.fn();
  expect(() =>
    clearDatabaseResources([
      () => {
        throw new Error("private UI text");
      },
      media,
      ui,
    ]),
  ).toThrow("Database resource cleanup failed.");
  expect(media).toHaveBeenCalledOnce();
  expect(ui).toHaveBeenCalledOnce();
});
