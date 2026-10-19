import { IconX } from "@tabler/icons-react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "../../ui/motion/reducedMotionPreference";
import { IconButton } from "../../ui/primitives/Button";
import type { NotificationItem } from "./notificationItems";

/** A horizontal drag this far, or a flick, dismisses the card. */
const DISMISS_DISTANCE = 96;
const FLICK_SPEED = 0.6;
/** A press must move this far sideways before it becomes a swipe, so buttons still click. */
const SWIPE_SLOP = 6;
const SLIDE_OUT_MS = 180;

const shortDate = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/** "now", "5m ago", "3h ago" within a day, "2d ago" within a week, then "17 Oct". */
export function formatNotificationTime(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate.format(at);
}

export interface NotificationCardProps {
  readonly item: NotificationItem;
  readonly now: number;
  readonly icon: ReactNode;
  readonly actions: ReactNode;
  readonly onDismiss: () => void;
}

/**
 * One notification: swiped sideways or closed with its X to dismiss. The swipe moves the card
 * through its own style, without rendering, and only a dismissal reaches the inbox.
 */
export function NotificationCard({ item, now, icon, actions, onDismiss }: NotificationCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const swiped = useRef(false);
  const swipe = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    speed: number;
    active: boolean;
  } | null>(null);

  const place = (offset: number, animate: boolean) => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition =
      animate && !reducedMotion
        ? `translate ${SLIDE_OUT_MS}ms ease-out, opacity ${SLIDE_OUT_MS}ms ease-out`
        : "none";
    card.style.translate = offset ? `${offset}px 0` : "";
    card.style.opacity = offset
      ? String(Math.max(0, 1 - Math.abs(offset) / (card.offsetWidth || 1)))
      : "";
  };

  const slideOut = (direction: number) => {
    const card = cardRef.current;
    if (!card || reducedMotion) {
      onDismiss();
      return;
    }
    place(direction * (card.offsetWidth + 16), true);
    window.setTimeout(onDismiss, SLIDE_OUT_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    swiped.current = false;
    swipe.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      speed: 0,
      active: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const state = swipe.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    if (!state.active) {
      if (Math.abs(event.clientY - state.startY) > SWIPE_SLOP) {
        swipe.current = null;
        return;
      }
      if (Math.abs(dx) < SWIPE_SLOP) return;
      state.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const elapsed = event.timeStamp - state.lastTime;
    if (elapsed > 0) state.speed = (event.clientX - state.lastX) / elapsed;
    state.lastX = event.clientX;
    state.lastTime = event.timeStamp;
    place(dx, false);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLElement>) => {
    const state = swipe.current;
    swipe.current = null;
    if (!state?.active || state.pointerId !== event.pointerId) return;
    swiped.current = true;
    const dx = event.clientX - state.startX;
    if (Math.abs(dx) > DISMISS_DISTANCE || Math.abs(state.speed) > FLICK_SPEED) {
      slideOut(Math.sign(dx || state.speed));
    } else {
      place(0, true);
    }
  };

  return (
    <article
      ref={cardRef}
      className="taskmap-notification-card"
      data-unread={!item.read || undefined}
      aria-label={item.title}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      // A finished swipe must not also click the button it started on.
      onClickCapture={(event) => {
        if (swiped.current) event.stopPropagation();
        swiped.current = false;
      }}
    >
      <span className="taskmap-notification-card__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="taskmap-notification-card__body">
        <div className="taskmap-notification-card__heading">
          <span className="taskmap-notification-card__title">{item.title}</span>
          <time
            className="taskmap-notification-card__time"
            dateTime={new Date(item.at).toISOString()}
          >
            {formatNotificationTime(item.at, now)}
          </time>
        </div>
        {item.detail && <p className="taskmap-notification-card__detail">{item.detail}</p>}
        <div className="taskmap-notification-card__actions">{actions}</div>
      </div>
      <IconButton
        variant="ghost"
        size="compact"
        className="taskmap-notification-card__dismiss"
        aria-label={`Dismiss "${item.title}"`}
        title="Dismiss"
        icon={<IconX size={15} stroke={2} />}
        onClick={() => slideOut(1)}
      />
    </article>
  );
}
