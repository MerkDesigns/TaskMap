import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEventHandler,
  type PointerEventHandler,
  type ReactElement,
  type Ref,
} from "react";
import { FloatingPanel } from "./FloatingPanel";
import "./tooltip.css";

interface TooltipTriggerProps {
  readonly "aria-describedby"?: string;
  readonly onBlur?: FocusEventHandler<HTMLElement>;
  readonly onFocus?: FocusEventHandler<HTMLElement>;
  readonly onPointerEnter?: PointerEventHandler<HTMLElement>;
  readonly onPointerLeave?: PointerEventHandler<HTMLElement>;
  readonly ref?: Ref<HTMLElement>;
}

export interface TooltipProps {
  readonly children: ReactElement<TooltipTriggerProps>;
  readonly label: string;
  readonly openDelayMs?: number;
}

export function Tooltip({ children, label, openDelayMs = 0 }: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);

  const clearOpenTimer = () => {
    if (openTimerRef.current === null) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  };

  const openAfterDelay = () => {
    clearOpenTimer();
    if (openDelayMs <= 0) {
      setOpen(true);
      return;
    }
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      setOpen(true);
    }, openDelayMs);
  };

  const close = () => {
    clearOpenTimer();
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (openTimerRef.current !== null) window.clearTimeout(openTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    if (!rendered) return;
    const timer = window.setTimeout(() => setRendered(false), 120);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);
  const trigger = cloneElement(children, {
    "aria-describedby": open ? id : children.props["aria-describedby"],
    ref: mergeRefs(children.props.ref, anchorRef),
    onBlur: compose(children.props.onBlur, close),
    onFocus: compose(children.props.onFocus, () => {
      clearOpenTimer();
      setOpen(true);
    }),
    onPointerEnter: compose(children.props.onPointerEnter, openAfterDelay),
    onPointerLeave: compose(children.props.onPointerLeave, close),
  });

  return (
    <>
      {trigger}
      <FloatingPanel anchorRef={anchorRef} open={rendered} placement="top-center">
        <div
          id={id}
          role="tooltip"
          className="taskmap-tooltip"
          data-motion-state={open ? "open" : "closed"}
        >
          {label}
        </div>
      </FloatingPanel>
    </>
  );
}

function compose<Event>(
  original: ((event: Event) => void) | undefined,
  added: (event: Event) => void,
) {
  return (event: Event) => {
    original?.(event);
    added(event);
  };
}

function mergeRefs<Value>(first: Ref<Value> | undefined, second: Ref<Value>): Ref<Value> {
  return (value) => {
    setRef(first, value);
    setRef(second, value);
  };
}

function setRef<Value>(ref: Ref<Value> | undefined, value: Value | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}
