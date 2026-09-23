import { forwardRef, type HTMLAttributes, type Ref } from "react";
import {
  SharedSmallGlassPlane,
  type SharedSmallGlassPlaneProps,
} from "../../materials/SharedSmallGlassPlane";
import "./GlassListFrame.css";

interface GlassListFrameProps extends HTMLAttributes<HTMLDivElement> {
  readonly planeRef: Ref<HTMLDivElement>;
  readonly materialEnabled?: boolean;
  readonly batchId: string;
  readonly kind?: SharedSmallGlassPlaneProps["kind"];
  readonly blurPx?: number;
}

/** Common list framing only. Scroll and interaction state stay with the existing list owner. */
export const GlassListFrame = forwardRef<HTMLDivElement, GlassListFrameProps>(
  function GlassListFrame(
    { children, className, planeRef, materialEnabled = true, batchId, kind, blurPx, ...props },
    ref,
  ) {
    return (
      <div
        {...props}
        ref={ref}
        className={["taskmap-glass-list", className].filter(Boolean).join(" ")}
      >
        {materialEnabled && (
          <SharedSmallGlassPlane ref={planeRef} batchId={batchId} kind={kind} blurPx={blurPx} />
        )}
        {children}
      </div>
    );
  },
);
