import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, it } from "vitest";
import { ScrollIndicator } from "./ScrollIndicator";

afterEach(cleanup);

function metrics(element: HTMLElement, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

function Harness({ scrollHeight }: { readonly scrollHeight: number }) {
  const target = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div
        ref={(element) => {
          target.current = element;
          if (element) metrics(element, { scrollHeight, clientHeight: 100 });
        }}
        data-testid="target"
      />
      <ScrollIndicator targetRef={target} data-testid="indicator" />
    </div>
  );
}

it("stays hidden while the target cannot scroll", () => {
  const { getByTestId } = render(<Harness scrollHeight={100} />);
  expect(getByTestId("indicator")).toHaveAttribute("data-hidden", "true");
});

it("sizes the thumb from the visible fraction and moves it with scroll only", async () => {
  const { getByTestId } = render(<Harness scrollHeight={400} />);
  const indicator = getByTestId("indicator");
  const target = getByTestId("target");
  expect(indicator).toHaveAttribute("data-hidden", "false");
  const thumb = indicator.firstElementChild as HTMLElement;
  // Track has no layout in jsdom, so the thumb starts at its minimum size.
  expect(thumb.style.height).toBe("14px");
  // A content change re-measures: 100px track, 1/4 visible -> 25px thumb, 75px travel.
  metrics(indicator, { clientHeight: 100 });
  target.append(document.createElement("div"));
  await act(async () => {});
  expect(thumb.style.height).toBe("25px");
  metrics(target, { scrollTop: 150 });
  act(() => {
    target.dispatchEvent(new Event("scroll"));
  });
  expect(indicator).toHaveAttribute("data-active", "true");
  expect(thumb.style.transform).toBe("translate3d(0, 37.5px, 0)");
});
