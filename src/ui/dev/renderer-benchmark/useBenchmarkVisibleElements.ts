import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getVisibleElementIds } from "../../../canvas/virtualization/viewportCulling";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) return false;
  for (const id of left) if (!right.has(id)) return false;
  return true;
}

export function useBenchmarkVisibleElements(
  store: BenchmarkSceneStore,
  viewport: BenchmarkViewportController,
  structuralVersion: number,
) {
  const pinnedIds = useRef(new Set<string>());
  const cullableElements = useRef(
    store.scene.elements.map((element) => ({ id: element.id, geometry: element })),
  );
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(store.scene.elements.map(({ id }) => id)),
  );
  const refresh = useCallback(() => {
    const next = getVisibleElementIds({
      viewport: store.scene.camera,
      elements: cullableElements.current,
      pinnedIds: pinnedIds.current,
    });
    setVisibleIds((current) => (setsEqual(current, next) ? current : next));
  }, [store]);

  useLayoutEffect(() => {
    viewport.bindVisibilityPublisher(refresh);
    return () => viewport.bindVisibilityPublisher(null);
  }, [refresh, viewport]);
  useLayoutEffect(() => {
    cullableElements.current = store.scene.elements.map((element) => ({
      id: element.id,
      geometry: element,
    }));
    refresh();
  }, [refresh, store, structuralVersion]);

  const pinElement = useCallback(
    (id: string, pinned: boolean) => {
      if (pinned) pinnedIds.current.add(id);
      else pinnedIds.current.delete(id);
      refresh();
    },
    [refresh],
  );

  const elements = useMemo(() => {
    // The store intentionally publishes a version for in-place structural additions.
    // Reading it here keeps this derived array stable between those publications.
    void structuralVersion;
    return store.scene.elements.filter(({ id }) => visibleIds.has(id));
  }, [store, structuralVersion, visibleIds]);
  return {
    elements,
    pinElement,
  };
}
