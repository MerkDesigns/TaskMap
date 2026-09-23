import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import App from "../App";
import { useRetainedCanvasSettings } from "./useRetainedCanvasSettings";
import {
  RetainedCanvasContext,
  useRetainedCanvasDocument,
  type RetainedApplicationRuntime,
  type RetainedCanvasContextValue,
} from "./RetainedCanvasContext";

/** Mounts the retained App presentation only after the entry gate has admitted its resources. */
export function RetainedCanvasApplication({
  runtime,
}: {
  readonly runtime: RetainedApplicationRuntime;
}) {
  const [view, setView] = useState<RetainedCanvasContextValue | null>(null);
  const [failed, setFailed] = useState(false);
  const owner = useRef<RetainedCanvasContextValue | null>(null);
  const generation = useRef(0);
  const attached = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    attached.current = true;
    const lifetime = generation;
    lifetime.current++;
    if (!owner.current) {
      try {
        const binding = runtime.bindCanvas({
          viewport: {
            pan: { x: -520, y: -420 },
            zoom: 1,
            screen: { width: window.innerWidth, height: window.innerHeight },
          },
          panFrameScheduler: {
            schedule: (callback) => window.requestAnimationFrame(callback),
            cancel: (handle) => window.cancelAnimationFrame(handle),
          },
          onRevoke() {
            owner.current = null;
            // Native/session revocation must remove editors and portals before returning.
            if (attached.current && host.current) flushSync(() => setView(null));
            else if (attached.current) setView(null);
          },
        });
        owner.current = { runtime, binding };
      } catch {
        setFailed(true);
      }
    }
    setView(owner.current);
    return () => {
      attached.current = false;
      const token = ++lifetime.current;
      // StrictMode reattaches this same lifetime before the microtask, without creating a second owner.
      queueMicrotask(() => {
        if (lifetime.current === token) owner.current?.binding.dispose();
      });
    };
  }, [runtime]);
  if (failed)
    return <p role="alert">The canvas could not be opened. Close and reopen the database.</p>;
  if (!view) return null;
  return (
    <div ref={host} style={{ display: "contents" }}>
      <RetainedCanvasContext.Provider value={view}>
        <App
          useDocument={useRetainedCanvasDocument}
          useSettings={useRetainedCanvasSettings}
          retained={view}
        />
      </RetainedCanvasContext.Provider>
    </div>
  );
}
