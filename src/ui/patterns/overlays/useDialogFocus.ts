import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocus(
  open = true,
  initialFocusRef?: Readonly<{ current: HTMLElement | null }>,
) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    // Initial focus skips the header close action so content/actions receive it first.
    const focusable = focusableElements();
    const initial =
      initialFocusRef?.current ??
      focusable.find((element) => !element.closest(".taskmap-modal-dialog__header")) ??
      focusable[0] ??
      dialog;
    initial.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const openDialogs = Array.from(
        document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"),
      );
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      const focusable = focusableElements();
      event.preventDefault();
      if (focusable.length === 0) {
        dialog.focus();
        return;
      }
      // Primitives default to tabIndex -1, so the dialog owns Tab order completely.
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next =
        current === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (current + step + focusable.length) % focusable.length;
      focusable[next].focus();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus();
    };
  }, [initialFocusRef, open]);

  return dialogRef;
}
