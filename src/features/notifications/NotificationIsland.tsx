import {
  IconCalendarEvent,
  IconCalendarPlus,
  IconCircle,
  IconCircleCheck,
  IconDownload,
  IconInbox,
  IconX,
  IconAlarm,
  IconSquarePlus,
} from "@tabler/icons-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { systemZoneResolver } from "../../domain/calendar/zoneResolver";
import { useIslandReveal } from "../../ui/patterns/workspace/useIslandReveal";
import { ToolbarGroup } from "../../ui/patterns/workspace/FloatingCanvasToolbar";
import { Button, IconButton } from "../../ui/primitives/Button";
import { ScrollArea } from "../../ui/primitives/Layout";
import { LiquidTabs } from "../../ui/primitives/LiquidTabs";
import {
  NOTIFICATION_PANEL_TOGGLE,
  publishNotificationPanelExpanded,
  useNotificationPanelToggleRequests,
  type NotificationCenter,
} from "./notificationCenter";
import { NotificationCard } from "./NotificationCard";
import { upcomingSections, type NotificationItem, type UpcomingItem } from "./notificationItems";
import { SnoozeMenu } from "./SnoozeMenu";
import "./notificationIsland.css";

/** The island's size, compact and expanded; notificationIsland.css lays out the same. */
const ISLAND_WIDTH = 300;
/** One compact button with the toolbar group's padding either side. */
const COMPACT_WIDTH = 44;
const COMPACT_HEIGHT = 40;
const EXPANDED_HEIGHT = 460;

type Tab = "notifications" | "upcoming";

export interface NotificationIslandProps {
  readonly center: NotificationCenter;
  readonly radius?: number;
}

/**
 * The notification centre left of the window controls, like a phone's: an inbox button with the
 * unread count that expands into the notifications and what is coming up. Closing it marks what
 * was shown as read.
 */
export function NotificationIsland({ center, radius }: NotificationIslandProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<Tab>("notifications");
  const id = useId();
  const [snoozing, setSnoozing] = useState<{
    readonly item: NotificationItem;
    readonly at: { readonly left: number; readonly top: number };
  } | null>(null);
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const snoozeReturnFocus = useRef<HTMLElement | null>(null);
  const { expanded, tall, expand, collapse } = useIslandReveal({
    surfaceRef,
    width: ISLAND_WIDTH,
    compactWidth: COMPACT_WIDTH,
    compactHeight: COMPACT_HEIGHT,
    expandedHeight: EXPANDED_HEIGHT,
    // The snooze menu is portalled outside the island and takes clicks and Escape for itself.
    holdOpen: snoozeMenuOpen,
    toggleSelector: `[${NOTIFICATION_PANEL_TOGGLE}]`,
  });
  const toggle = useCallback(
    () => (expanded ? collapse() : expand()),
    [collapse, expand, expanded],
  );
  useNotificationPanelToggleRequests(toggle);

  const markAllRead = useRef(center.markAllRead);
  markAllRead.current = center.markAllRead;
  const wasExpanded = useRef(false);
  useEffect(() => {
    publishNotificationPanelExpanded(expanded);
    if (wasExpanded.current && !expanded) markAllRead.current();
    wasExpanded.current = expanded;
  }, [expanded]);
  useEffect(() => () => publishNotificationPanelExpanded(false), []);

  const tabs = [
    { value: "notifications" as const, label: "Notifications", panelId: `${id}-notifications` },
    { value: "upcoming" as const, label: "Upcoming", panelId: `${id}-upcoming` },
  ];
  const unread = center.unreadCount;

  return (
    <ToolbarGroup
      ref={surfaceRef}
      label="Notification centre"
      radius={radius}
      sleepCorner="top-right"
      geometrySource="owner"
      className="taskmap-notifications"
      data-expanded={expanded || undefined}
      data-tall={tall || undefined}
    >
      <div className="taskmap-notifications__content">
        <div className="taskmap-notifications__header">
          <span className="taskmap-notifications__title" aria-hidden="true">
            Inbox
          </span>
          <IconButton
            variant="ghost"
            size="compact"
            className="taskmap-notifications__toggle"
            aria-expanded={expanded}
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread"
            }
            title={expanded ? "Close notifications" : "Notifications"}
            icon={
              <span className="taskmap-notifications__icon">
                {expanded ? <IconX size={18} stroke={2} /> : <IconInbox size={18} stroke={2} />}
                {!expanded && unread > 0 && (
                  <span className="taskmap-notifications__count">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
            }
            onClick={toggle}
          />
        </div>
        <div className="taskmap-notifications__panel" inert={!expanded}>
          <LiquidTabs
            className="taskmap-notifications__tabs"
            // The island unclips and its panel fades in as it opens; blurred glass would flash.
            clearIndicator
            label="Notification centre"
            items={tabs}
            value={tab}
            onValueChange={setTab}
          />
          {tab === "notifications" ? (
            <NotificationsTab
              center={center}
              panelId={tabs[0].panelId}
              onSnooze={(item, event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                snoozeReturnFocus.current = event.currentTarget;
                setSnoozing({ item, at: { left: bounds.left, top: bounds.bottom + 4 } });
                setSnoozeMenuOpen(true);
              }}
            />
          ) : (
            <UpcomingTab center={center} panelId={tabs[1].panelId} />
          )}
        </div>
      </div>
      {snoozing && (
        <SnoozeMenu
          open={snoozeMenuOpen}
          onOpenChange={setSnoozeMenuOpen}
          at={snoozing.at}
          returnFocusRef={snoozeReturnFocus}
          onSnooze={(until) => center.snooze(snoozing.item, until)}
        />
      )}
    </ToolbarGroup>
  );
}

/** Alerts can be snoozed; missed-alert summaries and app notifications cannot. */
const SNOOZABLE = new Set<NotificationItem["kind"]>([
  "event-alert",
  "reminder-alert",
  "reminder-due",
]);

function NotificationsTab({
  center,
  panelId,
  onSnooze,
}: {
  readonly center: NotificationCenter;
  readonly panelId: string;
  readonly onSnooze: (item: NotificationItem, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="taskmap-notifications__tab-panel" id={panelId} role="tabpanel">
      <div className="taskmap-notifications__actions">
        <span className="taskmap-notifications__summary">
          {center.items.length === 0
            ? ""
            : center.items.length === 1
              ? "1 notification"
              : `${center.items.length} notifications`}
        </span>
        <Button
          variant="ghost"
          size="compact"
          disabled={center.items.length === 0}
          onClick={center.clearAll}
        >
          Clear all
        </Button>
      </div>
      <ScrollArea className="taskmap-notifications__list" scrollbar="hidden">
        {center.items.length === 0 ? (
          <p className="taskmap-notifications__empty">No notifications</p>
        ) : (
          center.items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              now={center.now}
              icon={
                item.kind === "update-available" ? (
                  <IconDownload size={18} stroke={2} />
                ) : item.target?.kind === "event" ? (
                  <IconCalendarEvent size={18} stroke={2} style={{ color: item.accent ?? "" }} />
                ) : (
                  <IconAlarm size={18} stroke={2} style={{ color: item.accent ?? "" }} />
                )
              }
              onDismiss={() => center.dismiss(item)}
              actions={
                <>
                  {item.kind === "update-available" && (
                    <Button variant="ghost" size="compact" onClick={center.installUpdate}>
                      Install
                    </Button>
                  )}
                  {SNOOZABLE.has(item.kind) && (
                    <Button
                      variant="ghost"
                      size="compact"
                      aria-haspopup="menu"
                      onClick={(event) => onSnooze(item, event)}
                    >
                      Snooze
                    </Button>
                  )}
                  {item.completable && (
                    <Button variant="ghost" size="compact" onClick={() => center.complete(item)}>
                      Mark done
                    </Button>
                  )}
                  {item.target && (
                    <Button variant="ghost" size="compact" onClick={() => center.open(item)}>
                      Open
                    </Button>
                  )}
                </>
              }
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}

function UpcomingTab({
  center,
  panelId,
}: {
  readonly center: NotificationCenter;
  readonly panelId: string;
}) {
  const { calendar } = center.calendar;
  const sections = useMemo(
    () => upcomingSections(calendar, systemZoneResolver.toLocal(center.now)),
    [calendar, center.now],
  );
  return (
    <div className="taskmap-notifications__tab-panel" id={panelId} role="tabpanel">
      <div className="taskmap-notifications__actions">
        <span className="taskmap-notifications__summary">Next 14 days</span>
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="New event"
          title="New event"
          icon={<IconCalendarPlus size={17} stroke={2} />}
          onClick={center.newEvent}
        />
        <IconButton
          variant="ghost"
          size="compact"
          aria-label="New reminder"
          title="New reminder"
          icon={<IconSquarePlus size={17} stroke={2} />}
          onClick={center.newReminder}
        />
      </div>
      <ScrollArea className="taskmap-notifications__list" scrollbar="hidden">
        {sections.length === 0 ? (
          <p className="taskmap-notifications__empty">Nothing coming up</p>
        ) : (
          sections.map((section) => (
            <section
              key={section.key}
              className="taskmap-notifications__section"
              aria-label={section.title}
              data-overdue={section.key === "overdue" || undefined}
            >
              <h3 className="taskmap-notifications__section-title">{section.title}</h3>
              {section.items.map((item) => (
                <UpcomingRow key={upcomingKey(item)} item={item} center={center} />
              ))}
            </section>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

function UpcomingRow({
  item,
  center,
}: {
  readonly item: UpcomingItem;
  readonly center: NotificationCenter;
}) {
  if (item.kind === "event") {
    const { event } = item;
    return (
      <button
        type="button"
        className="taskmap-notifications__row"
        onClick={() => center.calendar.openEvent(event.id)}
      >
        <span
          className="taskmap-notifications__row-accent"
          style={{ background: event.accent }}
          aria-hidden="true"
        />
        <span className="taskmap-notifications__row-text">
          <span className="taskmap-notifications__row-title">{event.title}</span>
          <span className="taskmap-notifications__row-detail">
            {[item.when, event.location].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
    );
  }
  const { reminder } = item;
  return (
    <div className="taskmap-notifications__row" data-reminder>
      <IconButton
        variant="ghost"
        size="compact"
        className="taskmap-notifications__complete"
        aria-label={`Mark "${reminder.title}" done`}
        title="Mark done"
        style={{ color: reminder.accent }}
        icon={
          reminder.completed ? (
            <IconCircleCheck size={18} stroke={2} />
          ) : (
            <IconCircle size={18} stroke={2} />
          )
        }
        onClick={() => center.setReminderCompleted(reminder.id, true)}
      />
      <button
        type="button"
        className="taskmap-notifications__row-text"
        onClick={() => center.calendar.openReminder(reminder.id)}
      >
        <span className="taskmap-notifications__row-title">{reminder.title}</span>
        {item.when && <span className="taskmap-notifications__row-detail">{item.when}</span>}
      </button>
    </div>
  );
}

function upcomingKey(item: UpcomingItem): string {
  return item.kind === "event" ? item.event.id : item.reminder.id;
}
