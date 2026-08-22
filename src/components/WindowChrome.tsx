import { IconCopy, IconMinus, IconSquare, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { windowChromeActions, type WindowChromeActions } from "../app/windowChrome";
import { MaterialSurface } from "../ui/materials/MaterialSurface";
import { IconButton } from "../ui/primitives/Button";
import "../ui/patterns/workspace/WindowChrome.css";
import { RIGHT_CHROME_GLASS_BATCH } from "../ui/patterns/workspace/WorkspaceChromeGlassBatches";

interface WindowChromeProps {
  readonly actions?: WindowChromeActions;
  readonly radius?: number;
}

export function WindowChrome({ actions = windowChromeActions, radius }: WindowChromeProps) {
  const [maximized, setMaximized] = useState(false);

  const refreshMaximized = useCallback(async () => {
    setMaximized(await actions.isMaximized());
  }, [actions]);

  useEffect(() => {
    let disposed = false;
    let stopListening: (() => void) | undefined;

    const refresh = async () => {
      const nextMaximized = await actions.isMaximized();
      if (!disposed) setMaximized(nextMaximized);
    };

    void refresh();
    void actions.onResized(refresh).then((stop) => {
      if (disposed) stop();
      else stopListening = stop;
    });

    return () => {
      disposed = true;
      stopListening?.();
    };
  }, [actions]);

  const handleDragPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.detail > 1) return;
    void actions.startDragging();
  };

  const handleDragDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    void toggleMaximize();
  };

  const toggleMaximize = async () => {
    await actions.toggleMaximize();
    await refreshMaximized();
  };

  const stopChromePointerPropagation = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const maximizeLabel = maximized ? "Restore window" : "Maximize window";

  return (
    <>
      <div
        className="taskmap-window-drag-region"
        aria-hidden="true"
        onDoubleClick={handleDragDoubleClick}
        onPointerDown={handleDragPointerDown}
      />
      <MaterialSurface
        material="acrylic-large"
        backdropSource="shared"
        elevation="none"
        radius={radius}
        role="group"
        aria-label="Window controls"
        data-glass-batch-target={RIGHT_CHROME_GLASS_BATCH}
        className="taskmap-window-controls"
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={stopChromePointerPropagation}
      >
        <IconButton
          variant="ghost"
          size="compact"
          title="Minimize window"
          aria-label="Minimize window"
          icon={<IconMinus size={16} stroke={2} />}
          onClick={() => void actions.minimize()}
        />
        <IconButton
          variant="ghost"
          size="compact"
          title={maximizeLabel}
          aria-label={maximizeLabel}
          icon={
            maximized ? <IconCopy size={14} stroke={1.8} /> : <IconSquare size={14} stroke={1.8} />
          }
          onClick={() => void toggleMaximize()}
        />
        <IconButton
          variant="ghost"
          size="compact"
          className="taskmap-window-controls__close"
          title="Close window"
          aria-label="Close window"
          icon={<IconX size={16} stroke={2} />}
          onClick={() => void actions.close()}
        />
      </MaterialSurface>
    </>
  );
}
