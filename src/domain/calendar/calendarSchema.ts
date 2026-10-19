import { z } from "zod";
import { asEntityId, type ExtensionId } from "../ids/entityIds";
import { localDateSchema, localDateTimeSchema, localTimeSchema } from "./localDateTime";

/** The document module holding events and reminders (ADR 011). Only recorded commands change it. */
export const CALENDAR_MODULE_ID: ExtensionId = asEntityId("extension", "calendar");

export const CALENDAR_LIMITS = Object.freeze({
  events: 1_000,
  reminders: 1_000,
  titleLength: 512,
  locationLength: 512,
  notesLength: 16_384,
  eventAlerts: 2,
  alertAmount: 999,
});

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EVENT_ID_PATTERN = new RegExp(`^calendar-event-${UUID}$`);
const REMINDER_ID_PATTERN = new RegExp(`^reminder-${UUID}$`);
export const calendarEventIdSchema = z.string().regex(EVENT_ID_PATTERN);
export const reminderIdSchema = z.string().regex(REMINDER_ID_PATTERN);

/** "15 minutes before", "1 day before"; amount 0 alerts at the time itself. */
export const alertOffsetSchema = z
  .object({
    amount: z.number().int().min(0).max(CALENDAR_LIMITS.alertAmount),
    unit: z.enum(["minute", "hour", "day", "week"]),
  })
  .strict();

export const eventTimingSchema = z
  .discriminatedUnion("kind", [
    /** Whole days, `endDate` inclusive. */
    z
      .object({ kind: z.literal("all-day"), startDate: localDateSchema, endDate: localDateSchema })
      .strict(),
    z
      .object({ kind: z.literal("timed"), start: localDateTimeSchema, end: localDateTimeSchema })
      .strict(),
  ])
  .refine(
    (timing) =>
      timing.kind === "all-day" ? timing.endDate >= timing.startDate : timing.end >= timing.start,
    "An event cannot end before it starts",
  );

const title = z.string().trim().min(1).max(CALENDAR_LIMITS.titleLength);
const accent = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const calendarEventSchema = z
  .object({
    id: calendarEventIdSchema,
    title,
    timing: eventTimingSchema,
    location: z.string().max(CALENDAR_LIMITS.locationLength),
    accent,
    alerts: z.array(alertOffsetSchema).max(CALENDAR_LIMITS.eventAlerts),
  })
  .strict();

export const reminderSchema = z
  .object({
    id: reminderIdSchema,
    title,
    /** Free text, often a link. */
    notes: z.string().max(CALENDAR_LIMITS.notesLength),
    accent,
    completed: z.boolean(),
    due: z.object({ date: localDateSchema, time: localTimeSchema.nullable() }).strict().nullable(),
    /** Only meaningful with a due date. */
    alert: alertOffsetSchema.nullable(),
  })
  .strict();

function keyedRecord<Item extends { readonly id: string }>(
  item: z.ZodType<Item>,
  limit: number,
  label: string,
) {
  return z
    .record(z.string(), item)
    .refine((records) => Object.keys(records).length <= limit, `At most ${limit} ${label}`)
    .refine(
      (records) => Object.entries(records).every(([key, value]) => key === value.id),
      `Every ${label} is keyed by its id`,
    );
}

export const calendarModuleSchema = z
  .object({
    version: z.literal(1),
    events: keyedRecord(calendarEventSchema, CALENDAR_LIMITS.events, "events"),
    reminders: keyedRecord(reminderSchema, CALENDAR_LIMITS.reminders, "reminders"),
  })
  .strict();

export type AlertOffset = z.infer<typeof alertOffsetSchema>;
export type EventTiming = z.infer<typeof eventTimingSchema>;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type CalendarModule = z.infer<typeof calendarModuleSchema>;

export function emptyCalendarModule(): CalendarModule {
  return { version: 1, events: {}, reminders: {} };
}
