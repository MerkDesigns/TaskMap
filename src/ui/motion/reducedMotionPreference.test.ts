import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import {
  createReducedMotionPreference,
  ReducedMotionProvider,
  useReducedMotion,
} from "./reducedMotionPreference";

describe("reduced motion preference", () => {
  it("publishes one shared media-query preference", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const createQuery = vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: "change", listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: "change", listener: () => void) => listeners.delete(listener),
    }));
    const preference = createReducedMotionPreference(createQuery);
    const listener = vi.fn();
    const unsubscribe = preference.subscribe(listener);
    expect(preference.getSnapshot()).toBe(false);
    expect(createQuery).toHaveBeenCalledTimes(1);
    matches = true;
    listeners.forEach((notify) => notify());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(preference.getSnapshot()).toBe(true);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });

  it("falls back to no reduction without matchMedia", () => {
    expect(createReducedMotionPreference(null).getSnapshot()).toBe(false);
  });

  it("allows a scoped provider override without changing the production preference", () => {
    function Probe() {
      return createElement("span", null, useReducedMotion() ? "reduced" : "normal");
    }
    render(
      createElement(ReducedMotionProvider, {
        override: true,
        children: createElement(Probe),
      }),
    );
    expect(screen.getByText("reduced")).toBeInTheDocument();
    cleanup();
    render(createElement(Probe));
    expect(screen.getByText("normal")).toBeInTheDocument();
    cleanup();
  });
});
