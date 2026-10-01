import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { markMaterialPresenceContent } from "../../materials/materialPresence";
import { useMotionFrameScheduler } from "../../motion/MotionProvider";
import {
  createPresenceMotion,
  type PresenceChannels,
  type PresenceMotion,
} from "../../motion/presenceMotion";
import { presetChannels } from "../../motion/presencePresets";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import { usePresencePreset } from "../../motion/usePresenceMotion";
import { ModalLayer, NestedModalLayer } from "./ModalLayer";
import { MODAL_PRESENCE_TIMING } from "./modalMotion";

export type ModalPresencePlacement = "root" | "nested";
export type ModalPresencePhase = "entering" | "open" | "closing" | "closed";

export interface ModalPresenceProps {
  readonly children: ReactNode;
  readonly open: boolean;
  readonly placement?: ModalPresencePlacement;
  readonly onExitComplete?: () => void;
  /** Close on a press outside the dialog (root placement only); ignored while a nested dialog is open. */
  readonly onDismiss?: () => void;
}

/** Root progress for nested composition, and a nested group's own progress (ModalLayer.css). */
const ROOT_PRESENCE_PROPERTY = "--taskmap-modal-root-presence";
const NESTED_PRESENCE_PROPERTY = "--taskmap-modal-nested-presence";

/**
 * Dialog presence through the shared presence controller. Glass fades through the inherited
 * material presence variable, glass-free content through marked subtrees, and the scrim by its own
 * opacity; the group itself only moves, so the dialog blur is never under ancestor opacity.
 */
export function ModalPresence({
  children,
  onDismiss,
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
  const motionRef = useRef<PresenceMotion | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const exitCompleteRef = useRef(onExitComplete);
  exitCompleteRef.current = onExitComplete;
  const scheduler = useMotionFrameScheduler();
  const reducedMotion = useReducedMotion();
  // Plain material fade: scaling the dialog made its separately drawn
  // shared-plane glass and DOM rim/controls land on different subpixels each frame (flicker).
  const preset = usePresencePreset("dialogs", "materialFade");
  const channels = presetChannels(preset, "materialFade");
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  useLayoutEffect(() => {
    if (!open || present) return;
    setPhase("entering");
    setPresent(true);
  }, [open, present]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!present || !group) return;
    const nested = placement === "nested";
    // Content can mount mid-animation (lazy dialogs); re-mark only while animating.
    const contentObserver = new MutationObserver(() => markMaterialPresenceContent(group));
    const motion = createPresenceMotion(group, {
      scheduler,
      reducedMotion,
      channels: groupChannels(channelsRef.current, nested),
      enter: MODAL_PRESENCE_TIMING.enter,
      exit: MODAL_PRESENCE_TIMING.exit,
      initialProgress: 0,
      onProgress: (progress) => {
        if (scrimRef.current) scrimRef.current.style.opacity = String(progress);
        // Nested glass composes root x nested presence in CSS, so either can animate alone.
        const property = nested ? NESTED_PRESENCE_PROPERTY : ROOT_PRESENCE_PROPERTY;
        if (progress === 1) group.style.removeProperty(property);
        else group.style.setProperty(property, String(progress));
      },
      onComplete: (endpoint) => {
        contentObserver.disconnect();
        if (endpoint === "visible") {
          setPhase("open");
          return;
        }
        setPhase("closed");
        setPresent(false);
        exitCompleteRef.current?.();
      },
    });
    motionRef.current = motion;
    observerRef.current = contentObserver;
    return () => {
      contentObserver.disconnect();
      observerRef.current = null;
      motion.destroy();
      motionRef.current = null;
    };
  }, [placement, present, reducedMotion, scheduler]);

  useLayoutEffect(() => {
    motionRef.current?.setChannels(groupChannels(channels, placement === "nested"));
  }, [channels, placement]);

  useLayoutEffect(() => {
    const motion = motionRef.current;
    const group = groupRef.current;
    if (!present || !motion || !group) return;
    markMaterialPresenceContent(group);
    observerRef.current?.observe(group, { childList: true, subtree: true });
    setPhase(open ? "entering" : "closing");
    if (open) motion.show();
    else motion.hide();
    // A recreated controller (scheduler/reduced-motion change) restarts from hidden.
  }, [open, present, reducedMotion, scheduler]);

  // While a root modal is present the window drag strip rises above its scrim (WindowChrome.css).
  useLayoutEffect(() => {
    if (!present || placement !== "root") return;
    return markRootModalOpen();
  }, [placement, present]);

  if (!present) return null;

  const layerProps = { groupRef, phase, scrimRef, children: childrenRef.current };
  return placement === "root" ? (
    <ModalLayer
      {...layerProps}
      onScrimPointerDown={
        onDismiss && open
          ? () => {
              if (!isNestedModalPresenceBlocking()) onDismiss();
            }
          : undefined
      }
    />
  ) : (
    <NestedModalLayer {...layerProps} />
  );
}

let openRootModals = 0;

function markRootModalOpen(): () => void {
  openRootModals += 1;
  document.documentElement.dataset.taskmapModalOpen = "true";
  return () => {
    openRootModals -= 1;
    if (openRootModals === 0) delete document.documentElement.dataset.taskmapModalOpen;
  };
}

/** A nested group's material presence comes from the composed CSS variable, not the controller. */
function groupChannels(channels: PresenceChannels, nested: boolean): PresenceChannels {
  return nested && channels.materialFade ? { ...channels, materialFade: false } : channels;
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
