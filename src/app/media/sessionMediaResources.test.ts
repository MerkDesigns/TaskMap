// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createSessionMediaResources } from "./createSessionMediaResources";
import { importRetainedImage } from "./importRetainedImage";
import { callbackSetup } from "../commands/retainedCallbackTestSupport";
import { geometryIds } from "../commands/retainedGeometryTestSupport";
import {
  createDeferred as deferred,
  settlePersistenceContinuations,
} from "../workspace/workspaceTestSupport";
import { asEntityId } from "../../domain/ids/entityIds";
import { imageElementSchema } from "../../elements/image/imageModel";
import { sessionSetup, unlockTestSession } from "../database/databaseSessionTestSupport";
import { renameCommand } from "../workspace/workspaceTestSupport";

const metadata = {
  id: asEntityId("media", "BBBBBBBBBBBBBBBBBBBBBBBB"),
  mimeType: "image/gif" as const,
  byteLength: 10,
  pixelWidth: 1,
  pixelHeight: 1,
  altText: null,
};
function mediaFixture() {
  const port = {
    choose: vi.fn(async () => ({ ok: true as const, value: metadata })),
    load: vi.fn(async () => ({ ok: true as const, value: new Blob(["test"]) })),
    import: vi.fn(async () => ({ ok: true as const, value: metadata })),
  };
  const client = { capture: vi.fn(() => port) };
  const urls = { create: vi.fn(() => "blob:test-owned"), revoke: vi.fn() };
  return { port, client, urls };
}

it("keeps pending and displayed media usable during a failed close, then revokes on cancellation", async () => {
  const setup = sessionSetup();
  await unlockTestSession(setup);
  const { client, port, urls } = mediaFixture();
  const media = createSessionMediaResources(setup.controller, client, urls);
  const loaded = media.acquire(metadata);
  expect(await loaded.ready).toBe("blob:test-owned");
  const pendingLoad = deferred<Awaited<ReturnType<typeof port.load>>>();
  port.load.mockReturnValueOnce(pendingLoad.promise);
  const loading = media.acquire({
    ...metadata,
    id: asEntityId("media", "CCCCCCCCCCCCCCCCCCCCCCCC"),
  });
  const pendingSave = deferred<Awaited<ReturnType<typeof setup.client.saveDocument>>>();
  setup.client.saveDocument.mockReturnValueOnce(pendingSave.promise);
  setup.controller.store.workspace.dispatchCommand(renameCommand("Unsaved"));
  const closing = setup.controller.prepareWindowClose();
  await settlePersistenceContinuations();
  expect(setup.controller.getSnapshot().busy).toBe(true);
  pendingLoad.resolve({ ok: true, value: new Blob(["test"]) });
  expect(await loading.ready).toBe("blob:test-owned");
  expect(urls.revoke).not.toHaveBeenCalled();
  expect((await media.import(new Blob(["test"]))).ok).toBe(false);
  pendingSave.resolve({
    ok: false,
    error: { code: "save_failure", message: "test", retryable: true },
  });
  expect((await closing).ok).toBe(false);
  expect(urls.revoke).not.toHaveBeenCalled();
  await setup.controller.cancel();
  expect(urls.revoke).toHaveBeenCalledTimes(2);
  loaded.release();
  loading.release();
  media.dispose();
  await setup.controller.dispose();
});

it("shares one lazy load per media and revokes its URL after the last lease", async () => {
  const setup = await callbackSetup();
  const { client, port, urls } = mediaFixture();
  const media = createSessionMediaResources(setup.controller, client, urls);
  expect(port.load).not.toHaveBeenCalled();
  const a = media.acquire(metadata),
    b = media.acquire(metadata);
  expect(await a.ready).toBe("blob:test-owned");
  expect(await b.ready).toBe("blob:test-owned");
  expect(port.load).toHaveBeenCalledTimes(1);
  a.release();
  expect(urls.revoke).not.toHaveBeenCalled();
  b.release();
  b.release();
  expect(urls.revoke).toHaveBeenCalledTimes(1);
  media.dispose();
  await setup.dispose();
});

it.each(["release", "lock", "reload"])(
  "never publishes a late media URL after %s",
  async (reason) => {
    const setup = await callbackSetup();
    const { client, port, urls } = mediaFixture();
    const pending = deferred<Awaited<ReturnType<typeof port.load>>>();
    port.load.mockReturnValue(pending.promise);
    const media = createSessionMediaResources(setup.controller, client, urls);
    const lease = media.acquire(metadata);
    if (reason === "release") lease.release();
    if (reason === "lock") await setup.controller.lock();
    if (reason === "reload")
      setup.store.workspace.load(setup.store.getState().documentWorkspace.document!, 4);
    pending.resolve({ ok: true, value: new Blob(["test"]) });
    expect(await lease.ready).toBeNull();
    expect(urls.create).not.toHaveBeenCalled();
    media.dispose();
    lease.release();
    await setup.dispose();
  },
);

it("bounds concurrent loads at two and skips cancelled queued work", async () => {
  const setup = await callbackSetup();
  const { client, port, urls } = mediaFixture();
  const pending = deferred<Awaited<ReturnType<typeof port.load>>>();
  port.load.mockReturnValue(pending.promise);
  const media = createSessionMediaResources(setup.controller, client, urls);
  const a = media.acquire(metadata);
  const b = media.acquire({ ...metadata, id: asEntityId("media", "CCCCCCCCCCCCCCCCCCCCCCCC") });
  const c = media.acquire({ ...metadata, id: asEntityId("media", "DDDDDDDDDDDDDDDDDDDDDDDD") });
  expect(port.load).toHaveBeenCalledTimes(2);
  c.release();
  pending.resolve({ ok: true, value: new Blob(["test"]) });
  await Promise.all([a.ready, b.ready, c.ready]);
  expect(port.load).toHaveBeenCalledTimes(2);
  media.clear();
  a.release();
  b.release();
  expect(urls.revoke).toHaveBeenCalledTimes(2);
  media.dispose();
  await setup.dispose();
});

it("imports metadata and image in one reversible transaction without bytes in workspace", async () => {
  const setup = await callbackSetup();
  const { client, urls } = mediaFixture();
  const media = createSessionMediaResources(setup.controller, client, urls);
  const before = setup.store.getState().documentWorkspace.document!;
  const image = imageElementSchema.parse({
    ...before.elements[geometryIds.image],
    id: asEntityId("element", "element-00000000-0000-4000-8000-000000000099"),
    data: { mediaId: null, placement: null, accent: "#476FA8", background: false },
  });
  expect(await importRetainedImage(setup.actions, media, new Blob(["test"]), image)).toEqual({
    ok: true,
    changed: true,
  });
  const after = setup.store.getState().documentWorkspace;
  expect(after.history.past).toHaveLength(1);
  expect(after.document!.mediaReferences[metadata.id]).toEqual(metadata);
  expect(after.document!.elements[image.id].data.mediaId).toBe(metadata.id);
  expect(setup.client.saveDocument).not.toHaveBeenCalled();
  expect(setup.actions.undo().ok).toBe(true);
  expect(setup.store.getState().documentWorkspace.document).toEqual(before);
  expect(setup.actions.redo().ok).toBe(true);
  await setup.store.workspace.flushSave();
  expect(setup.client.saveDocument).toHaveBeenCalledTimes(1);
  media.dispose();
  await setup.dispose();
});

it("does not insert after an async import's captured canvas changes", async () => {
  const setup = await callbackSetup();
  const { client, port, urls } = mediaFixture();
  const pending = deferred<Awaited<ReturnType<typeof port.import>>>();
  port.import.mockReturnValue(pending.promise);
  const media = createSessionMediaResources(setup.controller, client, urls);
  const document = setup.store.getState().documentWorkspace.document!;
  const input = imageElementSchema.parse({
    ...document.elements[geometryIds.image],
    data: { mediaId: null, placement: null, accent: "#476FA8", background: false },
  });
  const imported = importRetainedImage(setup.actions, media, new Blob(["test"]), input);
  setup.actions.switchCanvas(document.canvasOrder[1]);
  const before = setup.store.getState().documentWorkspace;
  pending.resolve({ ok: true, value: metadata });
  expect(await imported).toEqual({ ok: false, code: "expired-action" });
  expect(setup.store.getState().documentWorkspace).toBe(before);
  await settlePersistenceContinuations();
  media.dispose();
  await setup.dispose();
});
