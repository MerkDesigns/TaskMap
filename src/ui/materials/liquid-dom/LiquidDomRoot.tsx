import {
  type HTMLAttributes,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { LiquidDomContext } from "./liquidDomContext";
import {
  createLiquidDomRuntime,
  supportsLiquidDomRuntime,
  type LiquidDomRuntime,
} from "./liquidDomRuntime";
import "./LiquidDomBoundary.css";

export interface LiquidDomRootProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  readonly backdrop: ReactNode;
  readonly children: ReactNode;
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function LiquidDomRoot({ backdrop, children, className, ...props }: LiquidDomRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<LiquidDomRuntime | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvasHost = canvasHostRef.current;
    if (!root || !canvasHost || !supportsLiquidDomRuntime()) {
      return;
    }

    let nextRuntime: LiquidDomRuntime;
    try {
      nextRuntime = createLiquidDomRuntime(() => setRuntimeFailed(true));
    } catch {
      setRuntimeFailed(true);
      return;
    }
    canvasHost.append(nextRuntime.canvas);
    nextRuntime.syncBackdrop(root);
    setRuntime(nextRuntime);

    const syncBackdrop = () => nextRuntime.syncBackdrop(root);
    const resizeObserver = new ResizeObserver(syncBackdrop);
    resizeObserver.observe(root);

    return () => {
      resizeObserver.disconnect();
      nextRuntime.destroy();
      nextRuntime.canvas.remove();
      setRuntime(null);
    };
  }, []);

  const activeRuntime = runtimeFailed ? null : runtime;
  const contextValue = useMemo(
    () => ({ root: rootRef.current, runtime: activeRuntime }),
    [activeRuntime],
  );
  const state = activeRuntime ? "active" : "fallback";

  return (
    <div
      {...props}
      ref={rootRef}
      className={joinClassNames("taskmap-liquid-dom-root", className)}
      data-liquid-dom-state={state}
    >
      {activeRuntime ? (
        createPortal(backdrop, activeRuntime.backdropHost)
      ) : (
        <div className="taskmap-liquid-dom-fallback-backdrop">{backdrop}</div>
      )}
      <LiquidDomContext.Provider value={contextValue}>{children}</LiquidDomContext.Provider>
      <div ref={canvasHostRef} className="taskmap-liquid-dom-canvas-host" />
    </div>
  );
}
