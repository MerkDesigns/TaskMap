import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useMaterialSurfaceGeometryInvalidation } from "../../materials/MaterialSurfaceRegistration";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { ModalLayer, NestedModalLayer } from "./ModalLayer";
import {
  advanceModalMotion,
  MODAL_ENTER_FROM,
  MODAL_EXIT_TO,
  MODAL_REST,
  type ModalMotionState,
} from "./modalMotion";

export type ModalPresencePlacement = "root" | "nested";
export type ModalPresencePhase = "entering" | "open" | "closing" | "closed";

export interface ModalPresenceProps {
  readonly children: ReactNode;
  readonly open: boolean;
  readonly placement?: ModalPresencePlacement;
  readonly onExitComplete?: () => void;
}

export function ModalPresence({
  children,
  onExitComplete,
  open,
  placement = "root",
}: ModalPresenceProps) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState<ModalPresencePhase>(open ? "entering" : "closed");
  const childrenRef = useRef(children);
  if (open) childrenRef.current = children;
  const groupRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<ModalMotionState>(open ? MODAL_ENTER_FROM : MODAL_EXIT_TO);
  const initializedRef = useRef(false);
  const exitCompleteRef = useRef(onExitComplete);
  exitCompleteRef.current = onExitComplete;
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const invalidateGeometry = useMaterialSurfaceGeometryInvalidation();

  const write = useCallback(
    (state: ModalMotionState, active: boolean) => {
      stateRef.current = state;
      const group = groupRef.current;
      if (group) {
        group.style.opacity = `${state.opacity}`;
        group.style.transform = `translate3d(0, ${state.translateY}px, 0) scale(${state.scale})`;
        group.style.transformOrigin = "center";
        group.style.willChange = active ? "opacity, transform" : "";
      }
      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.opacity = `${state.scrimOpacity}`;
        scrim.style.willChange = active ? "opacity" : "";
      }
      invalidateGeometry();
    },
    [invalidateGeometry],
  );

  useLayoutEffect(() => {
    if (open && !present) {
      stateRef.current = MODAL_ENTER_FROM;
      initializedRef.current = false;
      setPhase("entering");
      setPresent(true);
      return;
    }
    if (!present) return;

    const opening = open;
    const target = opening ? MODAL_REST : MODAL_EXIT_TO;
    const from = initializedRef.current
      ? stateRef.current
      : opening
        ? MODAL_ENTER_FROM
        : MODAL_REST;
    initializedRef.current = true;
    setPhase(opening ? "entering" : "closing");

    if (reducedMotion || from === target) {
      write(target, false);
      if (opening) setPhase("open");
      else {
        initializedRef.current = false;
        setPhase("closed");
        setPresent(false);
        exitCompleteRef.current?.();
      }
      return;
    }

    write(from, true);
    let elapsedMs = 0;
    return scheduler.subscribe(({ deltaMs }) => {
      elapsedMs += deltaMs;
      const next = advanceModalMotion(from, opening, elapsedMs);
      write(next.state, !next.settled);
      if (!next.settled) return true;
      if (opening) setPhase("open");
      else {
        initializedRef.current = false;
        setPhase("closed");
        setPresent(false);
        exitCompleteRef.current?.();
      }
      return false;
    });
  }, [open, present, reducedMotion, scheduler, write]);

  if (!present) return null;

  const layerProps = { groupRef, phase, scrimRef, children: childrenRef.current };
  return placement === "root" ? (
    <ModalLayer {...layerProps} />
  ) : (
    <NestedModalLayer {...layerProps} />
  );
}

export function isModalPresenceBlocking(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(document.querySelector("[data-taskmap-modal-presence-blocking='true']"))
  );
}

export function isNestedModalPresenceBlocking(): boolean {
  return (
    typeof document !== "undefined" &&
    Boolean(
      document.querySelector(
        "[data-taskmap-modal-presence-level='nested'][data-taskmap-modal-presence-blocking='true']",
      ),
    )
  );
}
