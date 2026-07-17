import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ImageMeta } from "../types";

type UseImageCacheOptions = {
  activeImages: Array<{ hash: string; format?: string }>;
  onStoreError: (error: unknown) => void;
};

type CachedImage = {
  url: string;
  lastUsed: number;
};

const MAX_UNUSED_IMAGE_URLS = 64;
const MAX_IMAGE_LOAD_RETRIES = 2;
const IMAGE_LOAD_RETRY_DELAY_MS = 120;

const imageFormatToMime = (format: string) =>
  format === "svg" ? "image/svg+xml" : format === "gif" ? "image/gif" : "image/webp";

const base64ToBlob = (data: string, mime: string) => {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

export function useImageCache({ activeImages, onStoreError }: UseImageCacheOptions) {
  const imageUrlCacheRef = useRef<Map<string, CachedImage>>(new Map());
  const imageUrlPendingRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const imageUrlRetryCountsRef = useRef<Map<string, number>>(new Map());
  const imageUrlRetryTimersRef = useRef<Map<string, number>>(new Map());
  const failedImageHashesRef = useRef<Set<string>>(new Set());
  const activeImageHashesRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const cacheEpochRef = useRef(0);
  const onStoreErrorRef = useRef(onStoreError);
  const loadImageUrlRef = useRef<(hash: string, format?: string) => void>(() => undefined);
  const [imageUrlVersion, setImageUrlVersion] = useState(0);

  useEffect(() => {
    const imageUrlCache = imageUrlCacheRef.current;
    const imageUrlPending = imageUrlPendingRef.current;
    const imageUrlRetryCounts = imageUrlRetryCountsRef.current;
    const imageUrlRetryTimers = imageUrlRetryTimersRef.current;
    const failedImageHashes = failedImageHashesRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cacheEpochRef.current += 1;
      imageUrlRetryTimers.forEach((timer) => window.clearTimeout(timer));
      imageUrlCache.forEach(({ url }) => URL.revokeObjectURL(url));
      imageUrlCache.clear();
      imageUrlPending.clear();
      imageUrlRetryCounts.clear();
      imageUrlRetryTimers.clear();
      failedImageHashes.clear();
    };
  }, []);

  useEffect(() => {
    onStoreErrorRef.current = onStoreError;
  });

  const pruneUnusedUrls = useCallback(() => {
    const unused = [...imageUrlCacheRef.current.entries()]
      .filter(([hash]) => !activeImageHashesRef.current.has(hash))
      .sort((left, right) => right[1].lastUsed - left[1].lastUsed);

    unused.slice(MAX_UNUSED_IMAGE_URLS).forEach(([hash, cached]) => {
      URL.revokeObjectURL(cached.url);
      imageUrlCacheRef.current.delete(hash);
    });
  }, []);

  const loadImageUrl = useCallback(
    (hash: string, format?: string) => {
      if (
        imageUrlCacheRef.current.has(hash) ||
        imageUrlPendingRef.current.has(hash) ||
        imageUrlRetryTimersRef.current.has(hash) ||
        failedImageHashesRef.current.has(hash)
      ) {
        return;
      }

      const resolvedFormat = format ?? "webp";
      const requestEpoch = cacheEpochRef.current;
      const pending = invoke<string>("load_image", { hash })
        .then((data) => {
          const url = URL.createObjectURL(base64ToBlob(data, imageFormatToMime(resolvedFormat)));
          if (imageUrlPendingRef.current.get(hash) === pending) {
            imageUrlPendingRef.current.delete(hash);
          }
          if (!mountedRef.current || requestEpoch !== cacheEpochRef.current) {
            URL.revokeObjectURL(url);
            return null;
          }

          imageUrlRetryCountsRef.current.delete(hash);
          failedImageHashesRef.current.delete(hash);
          imageUrlCacheRef.current.set(hash, { url, lastUsed: Date.now() });
          pruneUnusedUrls();
          setImageUrlVersion((version) => version + 1);
          return url;
        })
        .catch((error) => {
          const requestIsCurrent = imageUrlPendingRef.current.get(hash) === pending;
          if (requestIsCurrent) {
            imageUrlPendingRef.current.delete(hash);
          }
          if (
            !requestIsCurrent ||
            !mountedRef.current ||
            requestEpoch !== cacheEpochRef.current ||
            !activeImageHashesRef.current.has(hash)
          ) {
            return null;
          }

          const retryCount = imageUrlRetryCountsRef.current.get(hash) ?? 0;
          if (retryCount >= MAX_IMAGE_LOAD_RETRIES) {
            failedImageHashesRef.current.add(hash);
            console.error("Failed to load image", error);
            return null;
          }

          const nextRetryCount = retryCount + 1;
          imageUrlRetryCountsRef.current.set(hash, nextRetryCount);
          const timer = window.setTimeout(() => {
            imageUrlRetryTimersRef.current.delete(hash);
            if (mountedRef.current && activeImageHashesRef.current.has(hash)) {
              loadImageUrlRef.current(hash, resolvedFormat);
            }
          }, IMAGE_LOAD_RETRY_DELAY_MS * nextRetryCount);
          imageUrlRetryTimersRef.current.set(hash, timer);
          return null;
        });
      imageUrlPendingRef.current.set(hash, pending);
    },
    [pruneUnusedUrls],
  );
  loadImageUrlRef.current = loadImageUrl;

  useEffect(() => {
    const activeHashes = new Set(activeImages.map((image) => image.hash));
    activeImageHashesRef.current = activeHashes;
    imageUrlRetryTimersRef.current.forEach((timer, hash) => {
      if (!activeHashes.has(hash)) {
        window.clearTimeout(timer);
        imageUrlRetryTimersRef.current.delete(hash);
      }
    });
    imageUrlRetryCountsRef.current.forEach((_, hash) => {
      if (!activeHashes.has(hash)) {
        imageUrlRetryCountsRef.current.delete(hash);
      }
    });
    failedImageHashesRef.current.forEach((hash) => {
      if (!activeHashes.has(hash)) {
        failedImageHashesRef.current.delete(hash);
      }
    });
    activeImages.forEach((image) => loadImageUrl(image.hash, image.format));
    pruneUnusedUrls();
  }, [activeImages, loadImageUrl, pruneUnusedUrls]);

  const getImageUrl = useCallback((hash: string | undefined, _format?: string): string | null => {
    if (!hash) {
      return null;
    }

    const cached = imageUrlCacheRef.current.get(hash);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.url;
    }

    return null;
  }, []);

  const storeImageFromBytes = useCallback(
    async (buffer: ArrayBuffer): Promise<ImageMeta | null> => {
      try {
        return await invoke<ImageMeta>("store_image", { data: arrayBufferToBase64(buffer) });
      } catch (error) {
        console.error("Failed to store image", error);
        onStoreErrorRef.current(error);
        return null;
      }
    },
    [],
  );

  return {
    imageUrlVersion,
    getImageUrl,
    storeImageFromBytes,
  };
}
