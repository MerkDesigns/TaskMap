import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clamp } from "../canvasMath";
import type { DropBounds } from "../legacy/extensionDropTarget";
import { ExtensionDropEffect } from "./ExtensionDropEffect";

/** Long enough for the ripple shader to play out before its surface is removed. */
const RIPPLE_MS = 620;

interface Ripple {
  readonly id: string;
  readonly bounds: DropBounds;
  /** Where the ripple starts, relative to the bounds. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** The ripples playing over elements an extension was just dropped on. */
export function useExtensionDropRipples() {
  const [ripples, setRipples] = useState<readonly Ripple[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  /** Plays a ripple over `bounds`, starting at the canvas point. */
  const show = useCallback((point: { x: number; y: number }, bounds: DropBounds) => {
    const id = `extension-ripple-${nextId.current++}`;
    setRipples((current) => [
      ...current,
      { id, bounds, offsetX: point.x - bounds.left, offsetY: point.y - bounds.top },
    ]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setRipples((current) => current.filter((ripple) => ripple.id !== id));
    }, RIPPLE_MS);
    timers.current.add(timer);
  }, []);

  return useMemo(() => ({ ripples, show }), [ripples, show]);
}

export function ExtensionDropRipples({ ripples }: { readonly ripples: readonly Ripple[] }) {
  return ripples.map(({ id, bounds, offsetX, offsetY }) => (
    <div
      key={id}
      className="extension-drop-ripple-surface"
      style={{
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        borderRadius: bounds.borderRadius,
        borderTopLeftRadius: bounds.borderTopLeftRadius,
        borderTopRightRadius: bounds.borderTopRightRadius,
        borderBottomRightRadius: bounds.borderBottomRightRadius,
        borderBottomLeftRadius: bounds.borderBottomLeftRadius,
      }}
    >
      <ExtensionDropEffect
        originX={clamp(offsetX, 0, bounds.width)}
        originY={clamp(offsetY, 0, bounds.height)}
        width={bounds.width}
        height={bounds.height}
      />
    </div>
  ));
}
