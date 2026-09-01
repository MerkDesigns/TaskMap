import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useMotionFrameScheduler } from "./MotionProvider";
import { useReducedMotion } from "./reducedMotionPreference";
import {
  createPresenceController,
  type PresenceController,
  type PresenceEffects,
  type PresenceEndpoint,
} from "./presenceController";

export interface SurfacePresenceControls {
  show(): void;
  hide(): void;
  reverse(): void;
  setProgress(progress: number): void;
}

export interface SurfacePresenceOptions {
  readonly effects: PresenceEffects;
  readonly initialProgress?: number;
  readonly durationMs?: number;
  readonly onProgress?: (progress: number) => void;
  readonly onComplete?: (endpoint: PresenceEndpoint) => void;
  readonly onTransformWrite?: (transform: string) => void;
  readonly contentTargets?: () => readonly HTMLElement[];
}

export function useSurfacePresence(
  surfaceRef: RefObject<HTMLElement | null>,
  options: SurfacePresenceOptions,
): SurfacePresenceControls {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const controllerRef = useRef<PresenceController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const current = optionsRef.current;
    const controller = createPresenceController(surface, {
      scheduler,
      reducedMotion,
      effects: current.effects,
      durationMs: current.durationMs,
      initialProgress: current.initialProgress,
      onProgress: (progress) => optionsRef.current.onProgress?.(progress),
      onComplete: (endpoint) => optionsRef.current.onComplete?.(endpoint),
      onTransformWrite: (transform) => optionsRef.current.onTransformWrite?.(transform),
      contentTargets: () => optionsRef.current.contentTargets?.() ?? [],
    });
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [reducedMotion, scheduler, surfaceRef]);

  return useMemo(
    () => ({
      show: () => controllerRef.current?.show(),
      hide: () => controllerRef.current?.hide(),
      reverse: () => controllerRef.current?.reverse(),
      setProgress: (progress: number) => controllerRef.current?.setProgress(progress),
    }),
    [],
  );
}
