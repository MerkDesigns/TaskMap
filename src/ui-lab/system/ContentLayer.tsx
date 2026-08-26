import { forwardRef, type HTMLAttributes } from "react";

export type ContentLayerProps = HTMLAttributes<HTMLDivElement>;

export const ContentLayer = forwardRef<HTMLDivElement, ContentLayerProps>(function ContentLayer(
  { className, ...props },
  ref,
) {
  const contentClassName = ["taskmap-ui-lab-content-layer", className].filter(Boolean).join(" ");
  return <div {...props} ref={ref} className={contentClassName} />;
});
