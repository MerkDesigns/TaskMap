import { forwardRef, type HTMLAttributes } from "react";
import "./CanvasFrame.css";

export const CanvasFrame = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CanvasFrame({ className, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-canvas-frame", className].filter(Boolean).join(" ")}
      />
    );
  },
);
