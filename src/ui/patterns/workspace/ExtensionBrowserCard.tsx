import { forwardRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { primitiveClassNames } from "../../primitives/primitiveClassNames";
import "./ExtensionBrowserCard.css";

export interface ExtensionBrowserCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly embedded: boolean;
}

export const ExtensionBrowserCard = forwardRef<HTMLDivElement, ExtensionBrowserCardProps>(
  function ExtensionBrowserCard({ className, embedded, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material={embedded ? "opaque" : "acrylic-small"}
        radius={8}
        className={primitiveClassNames("taskmap-extension-browser-card", className)}
      />
    );
  },
);

export const ExtensionIconBox = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function ExtensionIconBox({ className, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material="cutout"
        radius={6}
        className={primitiveClassNames("taskmap-extension-browser-icon", className)}
      />
    );
  },
);
