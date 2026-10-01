import { useEffect, useRef } from "react";
import { revealCurrentWindow } from "../../platform/window/tauriWindowChromeClient";
import { whenWorkspaceIntroCanvasMounted } from "../../ui/patterns/workspace/workspaceIntro";

/**
 * Shows the (initially hidden) window once its first real screen has painted: the entry panel, or
 * for a resumed session the workspace once its canvas is mounted. Two frames let the browser paint
 * before Windows animates the window in. Runs once per window; the backend shows the window anyway
 * if this never happens.
 */
export function useRevealWindow(firstScreenReady: boolean, workspace: boolean): void {
  const scheduled = useRef(false);
  useEffect(() => {
    if (!firstScreenReady || scheduled.current) return;
    scheduled.current = true;
    // Deliberately not cancelled on re-render: once scheduled, the window must still be shown.
    const afterPaint = () =>
      requestAnimationFrame(() => requestAnimationFrame(() => void revealCurrentWindow()));
    if (workspace) whenWorkspaceIntroCanvasMounted(afterPaint);
    else afterPaint();
  }, [firstScreenReady, workspace]);
}
