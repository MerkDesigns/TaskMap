import { useCallback, useRef, useSyncExternalStore } from "react";

interface ExternalStore<Snapshot> {
  readonly getSnapshot: () => Snapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

export function useExternalStoreSelector<Snapshot, Selection>(
  store: ExternalStore<Snapshot>,
  selector: (snapshot: Snapshot) => Selection,
  isEqual: (previous: Selection, next: Selection) => boolean = Object.is,
): Selection {
  const selectorRef = useRef(selector);
  const equalityRef = useRef(isEqual);
  const cacheRef = useRef<{ snapshot: Snapshot; selection: Selection } | null>(null);
  if (selectorRef.current !== selector || equalityRef.current !== isEqual) {
    cacheRef.current = null;
  }
  selectorRef.current = selector;
  equalityRef.current = isEqual;

  const getSelection = useCallback(() => {
    const snapshot = store.getSnapshot();
    const cached = cacheRef.current;
    if (cached?.snapshot === snapshot) return cached.selection;

    const selection = selectorRef.current(snapshot);
    if (cached && equalityRef.current(cached.selection, selection)) {
      cacheRef.current = { snapshot, selection: cached.selection };
      return cached.selection;
    }

    cacheRef.current = { snapshot, selection };
    return selection;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
