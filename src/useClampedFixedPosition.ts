import { RefObject, useLayoutEffect, useState } from "react";

type FixedPosition = {
  left: number;
  top: number;
};

const VIEWPORT_MARGIN = 8;

export function useClampedFixedPosition<T extends HTMLElement>(
  ref: RefObject<T>,
  preferred: FixedPosition,
) {
  const { left: preferredLeft, top: preferredTop } = preferred;
  const [position, setPosition] = useState(preferred);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      setPosition({ left: preferredLeft, top: preferredTop });
      return;
    }

    const rect = node.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);

    setPosition({
      left: Math.min(Math.max(preferredLeft, VIEWPORT_MARGIN), maxLeft),
      top: Math.min(Math.max(preferredTop, VIEWPORT_MARGIN), maxTop),
    });
  }, [preferredLeft, preferredTop, ref]);

  return position;
}
