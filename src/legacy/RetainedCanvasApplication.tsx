import { useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import App from "../App";
import { CANVAS_BINDING_ALREADY_MOUNTED } from "../app/database/createApplicationDatabaseRuntime";
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
    const bind = () => {
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
          // A detached instance may only be hidden (React keeps a suspended tree to show it again):
          // it must not keep rendering the revoked binding; it binds afresh when shown.
          else setView(null);
        },
      });
      owner.current = { runtime, binding };
      return owner.current;
    };
    const fail = (error: unknown) => {
      // Static binding/projection reasons only; never document content.
      if (import.meta.env.DEV) {
        console.error(
          "Retained canvas binding failed:",
          error instanceof Error ? error.message : error,
        );
      }
      setFailed(true);
    };
    if (!owner.current) {
      try {
        bind();
      } catch (error) {
        if (error instanceof Error && error.message === CANVAS_BINDING_ALREADY_MOUNTED) {
          // A replaced instance (remount, hot reload) releases its binding in a microtask queued
          // during its cleanup; bind once more after it instead of failing the whole view.
          queueMicrotask(() => {
            if (!attached.current || owner.current) return;
            try {
              setView(bind());
            } catch (retryError) {
              fail(retryError);
            }
          });
        } else {
          fail(error);
        }
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
