import { act, cleanup, render, screen } from "@testing-library/react";
import { useContext, useSyncExternalStore } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  TransientInteractionContext,
  TransientInteractionProvider,
} from "./TransientInteractionProvider";
import type {
  TransientInteractionListener,
  TransientInteractionService,
  TransientInteractionSnapshot,
} from "./transientInteractionService";

afterEach(cleanup);

function InteractionProbe() {
  const service = useContext(TransientInteractionContext);
  if (!service) throw new Error("InteractionProbe requires TransientInteractionProvider");
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  return <span>{snapshot.activeInteraction?.kind ?? "idle"}</span>;
}

interface MutableTransientInteractionService extends TransientInteractionService {
  readonly publish: (snapshot: TransientInteractionSnapshot) => void;
}

function createMutableService(
  initialSnapshot: TransientInteractionSnapshot,
): MutableTransientInteractionService {
  let snapshot = initialSnapshot;
  const listeners = new Set<TransientInteractionListener>();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish: (nextSnapshot) => {
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("TransientInteractionProvider", () => {
  it("provides the idle default implementation", () => {
    render(
      <TransientInteractionProvider>
        <InteractionProbe />
      </TransientInteractionProvider>,
    );

    expect(screen.getByText("idle")).toBeInTheDocument();
  });

  it("provides an injected service whose snapshots reach subscribers", () => {
    const service = createMutableService({ activeInteraction: { kind: "drag" } });

    render(
      <TransientInteractionProvider service={service}>
        <InteractionProbe />
      </TransientInteractionProvider>,
    );

    expect(screen.getByText("drag")).toBeInTheDocument();

    act(() => service.publish({ activeInteraction: { kind: "resize" } }));

    expect(screen.getByText("resize")).toBeInTheDocument();
  });
});
