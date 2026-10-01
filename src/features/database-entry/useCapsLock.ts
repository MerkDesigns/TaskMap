import { useEffect, useState } from "react";

const EVENTS = ["keydown", "keyup", "pointerdown", "pointermove"] as const;

/**
 * Whether Caps Lock is on, read from the modifier state of any key or pointer event in the window
 * (browsers cannot query it directly), so the warning appears before the password is typed.
 */
export function useCapsLock(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const read = (event: KeyboardEvent | PointerEvent) => {
      if (typeof event.getModifierState !== "function") return;
      setOn(event.getModifierState("CapsLock"));
    };
    EVENTS.forEach((type) => window.addEventListener(type, read, true));
    return () => EVENTS.forEach((type) => window.removeEventListener(type, read, true));
  }, []);
  return on;
}
