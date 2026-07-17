import { IconAlertTriangle, IconCircleCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { ToastMessage, ToastTone } from "../types";

type ToastStackProps = {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
};

const TOAST_STYLES: Record<ToastTone, { Icon: typeof IconInfoCircle; iconClass: string }> = {
  info: { Icon: IconInfoCircle, iconClass: "text-sky-200" },
  success: { Icon: IconCircleCheck, iconClass: "text-emerald-200" },
  warning: { Icon: IconAlertTriangle, iconClass: "text-amber-200" },
  error: { Icon: IconAlertTriangle, iconClass: "text-red-200" },
};

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const { Icon, iconClass } = TOAST_STYLES[toast.tone];

        return (
          <div
            key={toast.id}
            className={`${toast.exiting ? "toast-exit" : "toast-enter"} toast-item pointer-events-auto overflow-hidden rounded-lg border border-white/[0.15] bg-[#1b1b1e]/94 p-3 text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-md`}
          >
            <div className="flex items-start gap-3">
              <Icon size={19} stroke={2} className={`mt-0.5 shrink-0 ${iconClass}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-5">{toast.title}</div>
                {toast.message && (
                  <div className="mt-0.5 text-xs leading-5 text-white/58">{toast.message}</div>
                )}
              </div>
              <button
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/[0.10] hover:text-white"
                onClick={() => onDismiss(toast.id)}
                title="Dismiss notification"
              >
                <IconX size={16} stroke={2} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
