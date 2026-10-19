import { z } from "zod";
import { calendarEventIdSchema, reminderIdSchema } from "../calendar/calendarSchema";
import { localDateSchema, localDateTimeSchema } from "../calendar/localDateTime";
import { asEntityId, type ExtensionId } from "../ids/entityIds";

/**
 * The document module holding notification bookkeeping (ADR 011): inbox entries, which alerts have
 * fired, and how far alerts have been scanned. Only unrecorded commands change it, so it never
 * disturbs the undo history of the calendar beside it.
 */
export const INBOX_MODULE_ID: ExtensionId = asEntityId("extension", "notification-inbox");

export const INBOX_LIMITS = Object.freeze({
  entries: 200,
  firedAlerts: 2_000,
  alertKeyLength: 256,
  /** Fired-alert keys older than this are forgotten. */
  firedRetentionMs: 30 * 86_400_000,
  missedCount: 10_000,
});

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const inboxEntryIdSchema = z.string().regex(new RegExp(`^inbox-entry-${UUID}$`));
const instant = z.number().int().min(0).max(8_640_000_000_000_000);

export const inboxEntrySchema = z
  .object({
    id: inboxEntryIdSchema,
    kind: z.enum(["event-alert", "reminder-alert", "reminder-due", "missed-alerts"]),
    /** What the entry is about; the title is looked up there, never copied. */
    source: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("event"), id: calendarEventIdSchema }).strict(),
        z.object({ kind: z.literal("reminder"), id: reminderIdSchema }).strict(),
      ])
      .nullable(),
    /** Which occurrence fired, for repeating events. */
    occurrence: z.union([localDateSchema, localDateTimeSchema]).nullable(),
    firedAt: instant,
    read: z.boolean(),
    snoozedUntil: instant.nullable(),
    /** For "missed-alerts": how many alerts it stands for. */
    missedCount: z.number().int().min(0).max(INBOX_LIMITS.missedCount),
  })
  .strict();

export const inboxModuleSchema = z
  .object({
    version: z.literal(1),
    entries: z
      .record(z.string(), inboxEntrySchema)
      .refine((records) => Object.keys(records).length <= INBOX_LIMITS.entries)
      .refine((records) => Object.entries(records).every(([key, value]) => key === value.id)),
    /** Alert key to the instant it fired, so an alert never fires twice. */
    fired: z
      .record(z.string().min(1).max(INBOX_LIMITS.alertKeyLength), instant)
      .refine((records) => Object.keys(records).length <= INBOX_LIMITS.firedAlerts),
    /** Alerts due at or before this instant have been handled. */
    scannedThrough: instant,
  })
  .strict();

export type InboxEntry = z.infer<typeof inboxEntrySchema>;
export type InboxModule = z.infer<typeof inboxModuleSchema>;

export function emptyInboxModule(scannedThrough: number): InboxModule {
  return { version: 1, entries: {}, fired: {}, scannedThrough };
}
