import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { LiquidDomContext } from "./liquidDomContext";
import type { LiquidSurfaceRegistration } from "./liquidDomRuntime";
import type { LiquidMaterialRole } from "./materialRoles";

export interface LiquidMaterialSurfaceProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  readonly role: LiquidMaterialRole;
  /** Scene stacking order. This is layout, not part of the optical material role. */
  readonly sceneOrder?: number;
  readonly children: ReactNode;
}

export interface LiquidMaterialSurfaceHandle {
  readonly anchor: HTMLDivElement | null;
  refresh(): void;
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export const LiquidMaterialSurface = forwardRef<
  LiquidMaterialSurfaceHandle,
  LiquidMaterialSurfaceProps
>(function LiquidMaterialSurface(
  { role, sceneOrder = 0, children, className, ...props },
  forwardedRef,
) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const { root, runtime } = useContext(LiquidDomContext);
  const [registration, setRegistration] = useState<LiquidSurfaceRegistration | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !root || !runtime) {
      return;
    }

    const nextRegistration = runtime.registerSurface(role, sceneOrder);
    const sync = () => nextRegistration.sync(anchor, root);
    sync();
    setRegistration(nextRegistration);

    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(anchor);
    resizeObserver.observe(root);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      setRegistration(null);
      nextRegistration.dispose();
    };
  }, [role, root, runtime, sceneOrder]);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (anchor && root && registration) {
      registration.sync(anchor, root);
    }
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      get anchor() {
        return anchorRef.current;
      },
      refresh() {
        const anchor = anchorRef.current;
        if (anchor && root && registration) {
          registration.sync(anchor, root);
        }
      },
    }),
    [registration, root],
  );

  return (
    <div
      {...props}
      ref={anchorRef}
      className={joinClassNames("taskmap-liquid-material-surface", className)}
      data-liquid-material-role={role}
    >
      {registration ? createPortal(children, registration.contentHost) : children}
    </div>
  );
});
