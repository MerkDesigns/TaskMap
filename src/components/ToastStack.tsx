import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { useLayoutEffect, useRef } from "react";
import type { ToastMessage, ToastTone } from "../types";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { markMaterialPresenceContent } from "../ui/materials/materialPresence";
import { EASE_EMPHASIZED, EASE_STANDARD } from "../ui/motion/presencePresets";
import { usePresenceMotion } from "../ui/motion/usePresenceMotion";
import { IconButton } from "../ui/primitives/Button";
import "./ToastStack.css";

type ToastStackProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

const TONE_ICONS: Record<ToastTone, typeof IconInfoCircle> = {
  info: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  error: IconAlertTriangle,
};

/** Slides in from the right edge; the queue keeps an exiting toast until its exit has played. */
const TOAST_PRESENCE = {
  channels: { materialFade: true, slide: { x: 72 } },
  enter: { durationMs: 320, easing: EASE_EMPHASIZED },
  exit: { durationMs: 240, easing: EASE_STANDARD },
} as const;

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const surfaceRef = useRef<HTMLElement | null>(null);
  const presence = usePresenceMotion(surfaceRef, { ...TOAST_PRESENCE, initialProgress: 0 });
  useLayoutEffect(() => {
    if (surfaceRef.current) markMaterialPresenceContent(surfaceRef.current);
    if (toast.exiting) presence.hide();
    else presence.show();
  }, [presence, toast.exiting]);
  const Icon = TONE_ICONS[toast.tone];

  return (
    <MaterialSurface
      ref={surfaceRef}
      material="acrylic-large"
      radius={12}
      role={toast.tone === "error" ? "alert" : "status"}
      className="taskmap-toast"
      data-tone={toast.tone}
    >
      <div className="taskmap-toast__body">
        <Icon size={19} stroke={2} className="taskmap-toast__icon" aria-hidden="true" />
        <div className="taskmap-toast__text">
          <div className="taskmap-toast__title">{toast.title}</div>
          {toast.message && <div className="taskmap-toast__message">{toast.message}</div>}
        </div>
        <IconButton
          icon={<IconX size={16} stroke={2} />}
          variant="ghost"
          size="compact"
          aria-label="Dismiss notification"
          title="Dismiss notification"
          onClick={() => onDismiss(toast.id)}
        />
      </div>
    </MaterialSurface>
  );
}

/** Notifications in the top-right corner over the workspace, newest first. */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (!toasts.length) return null;
  return (
    <div className="taskmap-toast-stack">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
