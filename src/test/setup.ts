import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        addListener: () => undefined,
        dispatchEvent: () => false,
        removeEventListener: () => undefined,
        removeListener: () => undefined,
      }) satisfies MediaQueryList,
    writable: true,
  });
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  class TestResizeObserver implements ResizeObserver {
    disconnect() {}

    observe() {}

    unobserve() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    configurable: true,
    value: TestResizeObserver,
    writable: true,
  });
}
