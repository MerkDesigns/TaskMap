import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ImageMeta } from "../types";

type UseImageCacheOptions = {
  onStoreError: (error: unknown) => void;
};

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

export function useImageCache({ onStoreError }: UseImageCacheOptions) {
  const imageUrlCacheRef = useRef<Map<string, string>>(new Map());
  const imageUrlPendingRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const onStoreErrorRef = useRef(onStoreError);
  const [imageUrlVersion, setImageUrlVersion] = useState(0);

  useEffect(() => {
    onStoreErrorRef.current = onStoreError;
  });

  const getImageUrl = useCallback((hash: string | undefined, format?: string): string | null => {
    if (!hash) {
      return null;
    }
    const resolvedFormat = format ?? "webp";

    const cached = imageUrlCacheRef.current.get(hash);
    if (cached) {
      return cached;
    }

    if (!imageUrlPendingRef.current.has(hash)) {
      const pending = invoke<string>("load_image", { hash })
        .then((data) => {
          const url = URL.createObjectURL(base64ToBlob(data, imageFormatToMime(resolvedFormat)));
          imageUrlCacheRef.current.set(hash, url);
          imageUrlPendingRef.current.delete(hash);
          setImageUrlVersion((version) => version + 1);
          return url;
        })
        .catch((error) => {
          console.error("Failed to load image", error);
          imageUrlPendingRef.current.delete(hash);
          return null;
        });
      imageUrlPendingRef.current.set(hash, pending);
    }

    return null;
  }, []);

  const storeImageFromBytes = useCallback(async (buffer: ArrayBuffer): Promise<ImageMeta | null> => {
    try {
      return await invoke<ImageMeta>("store_image", { data: arrayBufferToBase64(buffer) });
    } catch (error) {
      console.error("Failed to store image", error);
      onStoreErrorRef.current(error);
      return null;
    }
  }, []);

  useEffect(
    () => () => {
      imageUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      imageUrlCacheRef.current.clear();
    },
    [],
  );

  return {
    imageUrlVersion,
    getImageUrl,
    storeImageFromBytes,
  };
}
