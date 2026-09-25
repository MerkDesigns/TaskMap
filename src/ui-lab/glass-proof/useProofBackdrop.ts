import { useEffect, useRef, type PointerEvent } from "react";

/** Synthetic scene damage only: no material invalidation, layout reads or React updates per frame. */
export function useProofBackdrop(moving: boolean, animated: boolean) {
  const red = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const media = useRef<HTMLCanvasElement>(null);
  const position = useRef(0);
  const drag = useRef<{ pointerId: number; start: number; origin: number } | null>(null);
  const setPosition = (x: number) => {
    position.current = Math.max(0, Math.min(740, x));
    for (const element of [red.current, handle.current]) {
      if (!element) continue;
      element.style.transform = `translateX(${position.current}px)`;
      element.dataset.proofRedX = String(position.current);
    }
  };
  useEffect(() => {
    let frame = 0;
    let lastMediaFrame = -1;
    const start = performance.now();
    const context = media.current?.getContext("2d");
    const draw = (now: number) => {
      if (moving && !drag.current) setPosition(370 + Math.sin((now - start) / 1400) * 370);
      const mediaFrame = animated ? Math.floor((now - start) / 450) : 0;
      if (context && mediaFrame !== lastMediaFrame) {
        for (let y = 0; y < 6; y++)
          for (let x = 0; x < 8; x++) {
            context.fillStyle =
              (x + y) % 2
                ? mediaFrame % 2
                  ? "#f400c6"
                  : "#00e6ed"
                : mediaFrame % 2
                  ? "#6622ff"
                  : "#f7d900";
            context.fillRect(x * 30, y * 30, 30, 30);
          }
        if (media.current) media.current.dataset.proofMediaFrame = String(mediaFrame);
        lastMediaFrame = mediaFrame;
      }
      if (moving || animated) frame = requestAnimationFrame(draw);
    };
    draw(start);
    return () => cancelAnimationFrame(frame);
  }, [moving, animated]);
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    setPosition(drag.current.origin + event.clientX - drag.current.start);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    red,
    handle,
    media,
    setPosition,
    dragEvents: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (event.button !== 0) return;
        event.preventDefault();
        drag.current = {
          pointerId: event.pointerId,
          start: event.clientX,
          origin: position.current,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        if (drag.current?.pointerId === event.pointerId)
          setPosition(drag.current.origin + event.clientX - drag.current.start);
      },
      onPointerUp: finish,
      onPointerCancel() {
        drag.current = null;
      },
      onLostPointerCapture() {
        drag.current = null;
      },
    },
  };
}
