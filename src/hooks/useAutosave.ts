import { DependencyList, MutableRefObject, useCallback, useEffect, useRef } from "react";

type UseAutosaveOptions<T> = {
  enabled: boolean;
  dataRef: MutableRefObject<T>;
  dependencies: DependencyList;
  delayMs?: number;
  save: (data: T) => Promise<void>;
  onSaved?: () => void;
  onError: (error: unknown) => void;
};

export function useAutosave<T>({
  enabled,
  dataRef,
  dependencies,
  delayMs = 350,
  save,
  onSaved,
  onError,
}: UseAutosaveOptions<T>) {
  const timeoutRef = useRef<number | null>(null);
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
    enabledRef.current = enabled;
  });

  const cancelAutosave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const saveLatest = useCallback(async () => {
    try {
      await saveRef.current(dataRef.current);
      onSavedRef.current?.();
    } catch (error) {
      onErrorRef.current(error);
      throw error;
    }
  }, [dataRef]);

  const flushAutosave = useCallback(async () => {
    cancelAutosave();
    if (!enabledRef.current) {
      return;
    }
    await saveLatest();
  }, [cancelAutosave, saveLatest]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    cancelAutosave();
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      void saveLatest().catch(() => undefined);
    }, delayMs);

    return cancelAutosave;
    // This hook deliberately accepts the caller's dependency list, matching
    // React's built-in effect APIs while keeping the save callback ref-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelAutosave, delayMs, enabled, saveLatest, ...dependencies]);

  return { cancelAutosave, flushAutosave };
}
