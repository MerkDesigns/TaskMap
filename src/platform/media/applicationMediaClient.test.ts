// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createApplicationMediaClient } from "./applicationMediaClient";
import { invokePlatformRaw } from "../tauriInvoke";
vi.mock("../tauriInvoke", () => ({ invokePlatformRaw: vi.fn() }));
const invoke = vi.mocked(invokePlatformRaw);
const authority = { databaseId: "database-test", sessionId: "session-test" };
const id = "AAAAAAAAAAAAAAAAAAAAAAAA";
beforeEach(() => {
  invoke.mockReset();
});

it("redeems only an opaque drop token with captured authority and rejects a late session", async () => {
  let current: typeof authority | null = authority;
  const port = createApplicationMediaClient(() => current).capture()!;
  invoke.mockResolvedValue({
    ok: true,
    value: {
      kind: "stored",
      id,
      mimeType: "image/gif",
      byteLength: 10,
      pixelWidth: 80,
      pixelHeight: 80,
    },
  });
  expect((await port.importDrop("native-drop-token")).ok).toBe(true);
  expect(invoke).toHaveBeenCalledWith("app_import_dropped_image", {
    ...authority,
    token: "native-drop-token",
  });
  invoke.mockImplementation(async () => {
    current = null;
    return {
      ok: true,
      value: {
        kind: "stored",
        id,
        mimeType: "image/gif",
        byteLength: 10,
        pixelWidth: 80,
        pixelHeight: 80,
      },
    };
  });
  expect((await port.importDrop("next-drop-token")).ok).toBe(false);
  invoke.mockClear();
  expect((await port.importDrop("expired-drop-token")).ok).toBe(false);
  expect(invoke).not.toHaveBeenCalled();
});

it("streams bounded chunks with one captured session and validates returned metadata", async () => {
  invoke.mockImplementation(async (_command, input) => {
    const request = input as {
      databaseId: string;
      sessionId: string;
      operation: { action: string; data?: string; offset?: number };
    };
    expect(request.databaseId).toBe(authority.databaseId);
    expect(request.sessionId).toBe(authority.sessionId);
    const action = request.operation.action;
    if (action === "start") return { ok: true, value: { kind: "started", token: "upload-test" } };
    if (action === "finish")
      return {
        ok: true,
        value: {
          kind: "stored",
          id,
          mimeType: "image/gif",
          byteLength: 10,
          pixelWidth: 1,
          pixelHeight: 1,
        },
      };
    expect(atob(request.operation.data!).length).toBeLessThanOrEqual(256 * 1024);
    return { ok: true, value: { kind: "done" } };
  });
  const port = createApplicationMediaClient(() => authority).capture()!;
  const result = await port.import(new Blob([new Uint8Array(256 * 1024 + 7)]));
  expect(result).toMatchObject({ ok: true, value: { id, mimeType: "image/gif", altText: null } });
  expect(
    invoke.mock.calls.map(([, p]) => (p as { operation: { action: string } }).operation.action),
  ).toEqual(["start", "append", "append", "finish"]);
});

it.each(["image/png", "application/javascript"])(
  "rejects unexpected stored representation %s",
  async (mimeType) => {
    invoke
      .mockResolvedValueOnce({ ok: true, value: { kind: "started", token: "test" } })
      .mockResolvedValueOnce({ ok: true, value: { kind: "done" } })
      .mockResolvedValueOnce({
        ok: true,
        value: { kind: "stored", id, mimeType, byteLength: 1, pixelWidth: 1, pixelHeight: 1 },
      })
      .mockResolvedValue({ ok: true, value: { kind: "done" } });
    expect(
      (
        await createApplicationMediaClient(() => authority)
          .capture()!
          .import(new Blob(["x"]))
      ).ok,
    ).toBe(false);
  },
);

it("revokes a captured session before starting or continuing a transfer", async () => {
  let current: typeof authority | null = authority;
  const port = createApplicationMediaClient(() => current).capture()!;
  current = null;
  expect((await port.import(new Blob(["x"]))).ok).toBe(false);
  expect(invoke).not.toHaveBeenCalled();
});

it("loads chunked bytes but rejects truncated content and metadata mismatches", async () => {
  const port = createApplicationMediaClient(() => authority).capture()!;
  invoke
    .mockResolvedValueOnce({
      ok: true,
      value: { kind: "description", mimeType: "image/gif", byteLength: 3 },
    })
    .mockResolvedValueOnce({ ok: true, value: { kind: "chunk", data: btoa("abc") } });
  const loaded = await port.load(id, { mimeType: "image/gif", byteLength: 3 });
  expect(loaded.ok && (await loaded.value.text())).toBe("abc");
  invoke
    .mockResolvedValueOnce({
      ok: true,
      value: { kind: "description", mimeType: "image/gif", byteLength: 3 },
    })
    .mockResolvedValueOnce({ ok: true, value: { kind: "chunk", data: btoa("ab") } });
  expect((await port.load(id, { mimeType: "image/gif", byteLength: 3 })).ok).toBe(false);
  invoke.mockResolvedValueOnce({
    ok: true,
    value: { kind: "description", mimeType: "image/gif", byteLength: 3 },
  });
  expect((await port.load(id, { mimeType: "image/gif", byteLength: 4 })).ok).toBe(false);
});

it("cancels started uploads on local cancellation without sending another body", async () => {
  let cancelled = false;
  invoke.mockImplementation(async () => {
    cancelled = true;
    return { ok: true, value: { kind: "started", token: "test" } };
  });
  const result = await createApplicationMediaClient(() => authority)
    .capture()!
    .import(new Blob(["x"]), () => cancelled);
  expect(result.ok).toBe(false);
  expect(
    invoke.mock.calls.map(([, p]) => (p as { operation: { action: string } }).operation.action),
  ).toEqual(["start", "cancel"]);
});
