import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageCache } from "./useImageCache";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const createObjectUrlMock = vi.fn(() => `blob:image-${createObjectUrlMock.mock.calls.length}`);
const revokeObjectUrlMock = vi.fn();

describe("useImageCache", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("loads active images and exposes their object URLs", async () => {
    invokeMock.mockResolvedValue(btoa("image"));

    const { result } = renderHook(() =>
      useImageCache({
        activeImages: [{ hash: "hash-1", format: "webp" }],
        onStoreError: vi.fn(),
      }),
    );

    expect(result.current.isImageLoading("hash-1")).toBe(true);
    await waitFor(() => expect(result.current.getImageUrl("hash-1")).toBe("blob:image-1"));
    expect(result.current.isImageLoading("hash-1")).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith("load_image", { hash: "hash-1" });
  });

  it("loads active image bytes sequentially", async () => {
    const resolvers: Array<(value: string) => void> = [];
    invokeMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const activeImages = [
      { hash: "first", format: "webp" },
      { hash: "second", format: "webp" },
    ];
    const { rerender } = renderHook(
      ({ images }) =>
        useImageCache({
          activeImages: images,
          onStoreError: vi.fn(),
        }),
      { initialProps: { images: activeImages } },
    );

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));
    expect(invokeMock).toHaveBeenLastCalledWith("load_image", { hash: "first" });
    rerender({ images: [...activeImages] });
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0](btoa("first image"));
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(2));
    expect(invokeMock).toHaveBeenLastCalledWith("load_image", { hash: "second" });

    await act(async () => {
      resolvers[1](btoa("second image"));
    });
  });

  it("revokes a URL when an image load finishes after unmount", async () => {
    let resolveLoad: ((value: string) => void) | undefined;
    invokeMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { unmount } = renderHook(() =>
      useImageCache({
        activeImages: [{ hash: "late", format: "webp" }],
        onStoreError: vi.fn(),
      }),
    );
    await waitFor(() => expect(invokeMock).toHaveBeenCalledOnce());
    unmount();

    await act(async () => {
      resolveLoad?.(btoa("late image"));
      await Promise.resolve();
    });

    expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:image-1");
  });

  it("retains at most 64 inactive object URLs", async () => {
    invokeMock.mockResolvedValue(btoa("image"));
    const images = Array.from({ length: 65 }, (_, index) => ({ hash: `hash-${index}` }));
    const { rerender } = renderHook(
      ({ activeImages }) =>
        useImageCache({
          activeImages,
          onStoreError: vi.fn(),
        }),
      { initialProps: { activeImages: images } },
    );

    await waitFor(() => expect(createObjectUrlMock).toHaveBeenCalledTimes(65));
    rerender({ activeImages: [] });

    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1));
  });

  it("retries an active image after a transient load failure", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValueOnce(new Error("temporarily unavailable"));
    invokeMock.mockResolvedValueOnce(btoa("recovered image"));

    const { result } = renderHook(() =>
      useImageCache({
        activeImages: [{ hash: "retry", format: "webp" }],
        onStoreError: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(result.current.getImageUrl("retry")).toBe("blob:image-1");
  });

  it("cancels a scheduled retry when the image becomes inactive", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValue(new Error("temporarily unavailable"));
    const { rerender } = renderHook(
      ({ activeImages }) =>
        useImageCache({
          activeImages,
          onStoreError: vi.fn(),
        }),
      { initialProps: { activeImages: [{ hash: "inactive", format: "webp" }] } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    rerender({ activeImages: [] });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(invokeMock).toHaveBeenCalledOnce();
  });

  it("cancels a scheduled retry on unmount", async () => {
    vi.useFakeTimers();
    invokeMock.mockRejectedValue(new Error("temporarily unavailable"));
    const { unmount } = renderHook(() =>
      useImageCache({
        activeImages: [{ hash: "unmounted", format: "webp" }],
        onStoreError: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(invokeMock).toHaveBeenCalledOnce();
  });

  it("stops retrying after two retries", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    invokeMock.mockRejectedValue(new Error("still unavailable"));

    renderHook(() =>
      useImageCache({
        activeImages: [{ hash: "exhausted", format: "webp" }],
        onStoreError: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(invokeMock).toHaveBeenCalledTimes(3);
  });
});
