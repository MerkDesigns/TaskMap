import { forwardRef, useEffect, useRef, type HTMLAttributes } from "react";
import "./CanvasFrame.css";

const EDITABLE_TEXT = "textarea, input, [contenteditable='true'], [contenteditable='']";

export const CanvasFrame = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CanvasFrame({ className, ...props }, forwardedRef) {
    const frameRef = useRef<HTMLDivElement | null>(null);

    // Chromium extends a drag selection by hit-testing the element under the pointer. Over the
    // camera-transformed frame that maps the pointer far from the field being selected in, so a
    // selection dragged out of a text field elsewhere (an editor window, a panel) jumps. While such
    // a drag lasts the frame takes no hits and the pointer falls through to the untransformed
    // backdrop, which selects like the toolbars do.
    useEffect(() => {
      const frame = frameRef.current;
      if (!frame) return;
      const start = (event: PointerEvent) => {
        if (event.button !== 0 || !(event.target instanceof Element)) return;
        if (frame.contains(event.target) || !event.target.closest(EDITABLE_TEXT)) return;
        frame.setAttribute("data-text-selecting", "");
      };
      const end = () => frame.removeAttribute("data-text-selecting");
      document.addEventListener("pointerdown", start, true);
      window.addEventListener("pointerup", end, true);
      window.addEventListener("pointercancel", end, true);
      window.addEventListener("blur", end);
      return () => {
        document.removeEventListener("pointerdown", start, true);
        window.removeEventListener("pointerup", end, true);
        window.removeEventListener("pointercancel", end, true);
        window.removeEventListener("blur", end);
      };
    }, []);

    return (
      <div
        {...props}
        ref={(node) => {
          frameRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={["taskmap-canvas-frame", className].filter(Boolean).join(" ")}
      />
    );
  },
);
