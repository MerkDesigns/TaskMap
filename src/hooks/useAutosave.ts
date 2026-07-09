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

  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
    onErrorRef.current = onError;
  });

  const cancelAutosave = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    cancelAutosave();
    timeoutRef.current = window.setTimeout(() => {
      saveRef.current(dataRef.current)
        .then(() => {
          onSavedRef.current?.();
        })
        .catch((error) => {
          onErrorRef.current(error);
        });
    }, delayMs);

    return cancelAutosave;
  }, [cancelAutosave, dataRef, delayMs, enabled, ...dependencies]);

  return cancelAutosave;
}
