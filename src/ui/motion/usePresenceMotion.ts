import { createContext, useContext, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useMotionFrameScheduler } from "./MotionProvider";
import { useReducedMotion } from "./reducedMotionPreference";
import {
  createPresenceMotion,
  type PresenceChannels,
  type PresenceEndpoint,
  type PresenceMotion,
  type PresenceTiming,
} from "./presenceMotion";
import type { PresencePresetName } from "./presencePresets";

/** Surfaces whose presence preset the development workbench may override. */
export type PresenceSurfaceId = "quickExtensions" | "sidePanel" | "minimap" | "dialogs";

/**
 * Surface-specific motions that need live geometry and cannot be a fixed preset (e.g. sliding a
 * side panel fully off-screen).
 */
export type SurfacePresenceName =
  PresencePresetName | "offscreenSlide" | "fadeOffscreenSlide" | "fadeScaleOffscreenSlide";

/** Development-only overrides; production renders without a provider and uses defaults. */
export const PresencePresetOverrides = createContext<
  Partial<Record<PresenceSurfaceId, SurfacePresenceName>>
>({});

export function usePresencePreset<Name extends SurfacePresenceName>(
  surface: PresenceSurfaceId,
  fallback: Name,
): Name | SurfacePresenceName {
  return useContext(PresencePresetOverrides)[surface] ?? fallback;
}

export interface PresenceMotionHookOptions {
  readonly channels: PresenceChannels;
  readonly enter?: PresenceTiming;
  readonly exit?: PresenceTiming;
  readonly initialProgress?: number;
  readonly onComplete?: (endpoint: PresenceEndpoint) => void;
  readonly contentTargets?: () => readonly HTMLElement[];
}

export interface PresenceMotionControls {
  show(): void;
  hide(): void;
}

/** One presence owner per surface; channel changes are applied without recreating it. */
export function usePresenceMotion(
  surfaceRef: RefObject<HTMLElement | null>,
  options: PresenceMotionHookOptions,
): PresenceMotionControls {
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  const motionRef = useRef<PresenceMotion | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const current = optionsRef.current;
    const motion = createPresenceMotion(surface, {
      scheduler,
      reducedMotion,
      channels: current.channels,
      enter: current.enter,
      exit: current.exit,
      initialProgress: current.initialProgress,
      onComplete: (endpoint) => optionsRef.current.onComplete?.(endpoint),
      contentTargets: () => optionsRef.current.contentTargets?.() ?? [],
    });
    motionRef.current = motion;
    return () => {
      motion.destroy();
      motionRef.current = null;
    };
  }, [reducedMotion, scheduler, surfaceRef]);

  const { channels } = options;
  useLayoutEffect(() => {
    motionRef.current?.setChannels(channels);
  }, [channels]);

  return useMemo(
    () => ({
      show: () => motionRef.current?.show(),
      hide: () => motionRef.current?.hide(),
    }),
    [],
  );
}
