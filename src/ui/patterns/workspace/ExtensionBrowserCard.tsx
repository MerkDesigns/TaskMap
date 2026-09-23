import { forwardRef, type HTMLAttributes } from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { primitiveClassNames } from "../../primitives/primitiveClassNames";
import "./ExtensionBrowserCard.css";

export interface ExtensionBrowserCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly embedded: boolean;
  readonly geometryActive?: boolean;
  readonly radius?: number;
}

export const ExtensionBrowserCard = forwardRef<HTMLDivElement, ExtensionBrowserCardProps>(
  function ExtensionBrowserCard(
    { children, className, embedded, geometryActive = true, radius = 8, ...props },
    ref,
  ) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material={embedded ? "opaque" : "acrylic-small"}
        backdropSource={embedded ? undefined : "shared"}
        geometryActive={geometryActive}
        geometrySource="owner"
        radius={radius}
        className={primitiveClassNames("taskmap-extension-browser-card", className)}
      >
        <div className="taskmap-glass-list__content taskmap-extension-browser-card__content-mask">
          <div className="taskmap-extension-browser-card__content">{children}</div>
        </div>
      </MaterialSurface>
    );
  },
);

export interface ExtensionIconBoxProps extends HTMLAttributes<HTMLDivElement> {
  readonly radius?: number;
}

export const ExtensionIconBox = forwardRef<HTMLDivElement, ExtensionIconBoxProps>(
  function ExtensionIconBox({ className, radius = 6, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material="cutout"
        radius={radius}
        className={primitiveClassNames("taskmap-extension-browser-icon", className)}
      />
    );
  },
);
