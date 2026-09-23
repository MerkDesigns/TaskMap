// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createWindowCloseController } from "./createWindowCloseController";
import { createDatabaseEntryPreview } from "../features/database-entry/preview/createDatabaseEntryPreview";
import { createEntityId } from "../domain/ids/entityIds";

function fixture() {
  let nativeClose: () => void = () => {};
  const stop = vi.fn();
  const client = {
    onCloseRequested: vi.fn(async (listener: () => void) => {
      nativeClose = listener;
      return stop;
    }),
    destroy: vi.fn(async () => {}),
  };
  return { client, stop, nativeClose: () => nativeClose() };
}

it("serializes native/button close requests, saving and purging the real workspace before destroying the window", async () => {
  const runtime = createDatabaseEntryPreview();
  await runtime.controller.resume();
  await runtime.controller.create("fixture", "fixture-only");
  await runtime.initializeResources();
  const id = createEntityId("canvas", { nextUuid: () => "00000000-0000-4000-8000-000000000099" });
  expect(
    runtime.callbacks.captureCreateCanvas()!.complete({
      id,
      name: "Saved on close",
      elementOrder: [],
      settings: { width: 10000, height: 10000 },
    }).ok,
  ).toBe(true);
  const f = fixture();
  f.client.destroy.mockImplementation(async () => {
    expect(runtime.controller.getSnapshot().phase).toBe("closed");
    expect(runtime.controller.store.getState().documentWorkspace.document).toBeNull();
  });
  const prepareClose = vi.fn(runtime.controller.close);
  const onError = vi.fn();
  const close = createWindowCloseController({ client: f.client, prepareClose, onError });
  try {
    await close.ready;
    f.nativeClose();
    await Promise.all([close.requestClose(), close.requestClose()]);
    expect(prepareClose).toHaveBeenCalledTimes(1);
    expect(f.client.destroy).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    await runtime.controller.open("fixture");
    await runtime.controller.unlock("fixture-only");
    expect(runtime.controller.store.getState().documentWorkspace.document!.canvases[id].name).toBe(
      "Saved on close",
    );
  } finally {
    close.dispose();
    await runtime.controller.dispose();
  }
});

it("keeps the window open on save failure and allows retry", async () => {
  const f = fixture();
  let succeeds = false;
  const onError = vi.fn();
  const close = createWindowCloseController({
    client: f.client,
    onError,
    prepareClose: async () =>
      succeeds
        ? { ok: true, value: undefined }
        : { ok: false, error: { code: "save_failure", message: "fixture", retryable: true } },
  });
  try {
    await close.requestClose();
    expect(f.client.destroy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    succeeds = true;
    await close.requestClose();
    expect(f.client.destroy).toHaveBeenCalledTimes(1);
  } finally {
    close.dispose();
  }
});

it("disposal revokes an in-flight close and removes a late event registration", async () => {
  const f = fixture();
  let finishSave!: () => void;
  const close = createWindowCloseController({
    client: f.client,
    onError: vi.fn(),
    prepareClose: () =>
      new Promise((resolve) => {
        finishSave = () => resolve({ ok: true, value: undefined });
      }),
  });
  const closing = close.requestClose();
  await Promise.resolve();
  close.dispose();
  await close.ready;
  finishSave();
  await closing;
  expect(f.stop).toHaveBeenCalledTimes(1);
  expect(f.client.destroy).not.toHaveBeenCalled();
});
