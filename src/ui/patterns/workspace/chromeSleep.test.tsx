import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CHROME_SLEEP_IDLE_MS, useChromeAsleep, useChromeAutoHide } from "./chromeSleep";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Harness({
  enabled,
  onSleep,
  onWake,
}: {
  enabled: boolean;
  onSleep: () => void;
  onWake?: () => void;
}) {
  useChromeAutoHide(enabled, onSleep, onWake);
  return <output data-testid="state">{useChromeAsleep() ? "asleep" : "awake"}</output>;
}

const state = () => document.querySelector('[data-testid="state"]')!.textContent;
const idle = (ms = CHROME_SLEEP_IDLE_MS + 10) => act(() => vi.advanceTimersByTime(ms));

it("sleeps after the idle period and wakes on pointer movement", () => {
  const onSleep = vi.fn();
  const onWake = vi.fn();
  render(<Harness enabled onSleep={onSleep} onWake={onWake} />);
  idle(CHROME_SLEEP_IDLE_MS - 100);
  expect(state()).toBe("awake");
  idle(200);
  expect(state()).toBe("asleep");
  expect(onSleep).toHaveBeenCalledOnce();

  act(() => {
    window.dispatchEvent(new Event("pointermove"));
  });
  expect(state()).toBe("awake");
  expect(onWake).toHaveBeenCalledOnce();
  act(() => {
    window.dispatchEvent(new Event("pointermove"));
  });
  expect(onWake).toHaveBeenCalledOnce();
});

it("keeps the chrome awake while an overlay is open or a button is held", () => {
  render(<Harness enabled onSleep={vi.fn()} />);
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  idle();
  expect(state()).toBe("awake");
  dialog.remove();

  act(() => {
    window.dispatchEvent(new Event("pointerdown"));
  });
  idle();
  expect(state()).toBe("awake");
  act(() => {
    window.dispatchEvent(new Event("pointerup"));
  });
  idle();
  expect(state()).toBe("asleep");
});

it("never sleeps when disabled and wakes when it is switched off", () => {
  const { rerender } = render(<Harness enabled onSleep={vi.fn()} />);
  idle();
  expect(state()).toBe("asleep");
  rerender(<Harness enabled={false} onSleep={vi.fn()} />);
  expect(state()).toBe("awake");
  idle(CHROME_SLEEP_IDLE_MS * 3);
  expect(state()).toBe("awake");
});
