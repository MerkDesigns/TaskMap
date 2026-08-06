import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TransientInteractionProvider } from "./TransientInteractionProvider";
import type {
  TransientInteractionListener,
  TransientInteractionService,
  TransientInteractionSnapshot,
} from "./transientInteractionService";
import { useTransientInteraction } from "./useTransientInteraction";

afterEach(cleanup);

function InteractionProbe() {
  const snapshot = useTransientInteraction();
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

  it("reads an injected service through the typed snapshot hook", () => {
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
