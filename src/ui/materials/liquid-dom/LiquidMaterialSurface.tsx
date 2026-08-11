import {
  type HTMLAttributes,
  type ReactNode,
  useContext,
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
  readonly children: ReactNode;
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function LiquidMaterialSurface({
  role,
  children,
  className,
  ...props
}: LiquidMaterialSurfaceProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const { root, runtime } = useContext(LiquidDomContext);
  const [registration, setRegistration] = useState<LiquidSurfaceRegistration | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || !root || !runtime) {
      return;
    }

    const nextRegistration = runtime.registerSurface(role);
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
  }, [role, root, runtime]);

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
}
