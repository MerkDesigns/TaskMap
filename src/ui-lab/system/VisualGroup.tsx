import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from "react";

export const PRESENCE_PROGRESS_PROPERTY = "--taskmap-ui-lab-presence-progress";

export interface VisualGroupHandle {
  readonly element: HTMLDivElement | null;
  readPresenceProgress(): number;
  writePresenceProgress(progress: number, translateY: number): void;
}

export interface VisualGroupProps extends HTMLAttributes<HTMLDivElement> {
  readonly initialProgress?: number;
}

export const VisualGroup = forwardRef<VisualGroupHandle, VisualGroupProps>(function VisualGroup(
  { className, initialProgress = 1, style, ...props },
  forwardedRef,
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(clampProgress(initialProgress));

  const writePresenceProgress = useCallback((progress: number, translateY: number) => {
    const nextProgress = clampProgress(progress);
    const element = elementRef.current;
    progressRef.current = nextProgress;
    if (!element) return;

    element.style.setProperty(PRESENCE_PROGRESS_PROPERTY, String(nextProgress));
    element.style.transform =
      Math.abs(translateY) < 0.001 ? "" : `translate3d(0, ${translateY}px, 0)`;
    element.dataset.presenceProgress = nextProgress.toFixed(3);
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      get element() {
        return elementRef.current;
      },
      readPresenceProgress: () => progressRef.current,
      writePresenceProgress,
    }),
    [writePresenceProgress],
  );

  const progress = progressRef.current;
  const groupClassName = ["taskmap-ui-lab-visual-group", className].filter(Boolean).join(" ");
  const groupStyle = {
    ...style,
    [PRESENCE_PROGRESS_PROPERTY]: progress,
  } as CSSProperties;

  return (
    <div
      {...props}
      ref={elementRef}
      className={groupClassName}
      data-presence-progress={progress.toFixed(3)}
      style={groupStyle}
    />
  );
});

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}
