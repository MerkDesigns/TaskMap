import { z } from "zod";
import { inboxDocumentModule } from "../../document-modules/documentModules";
import {
  emptyInboxModule,
  inboxEntryIdSchema,
  inboxEntrySchema,
  INBOX_LIMITS,
  type InboxModule,
} from "../../notifications/inboxSchema";
import type { DomainCommandHandler } from "../commandHandler";
import { commandRejected, defineCommandHandler } from "../commandHandler";
import {
  ensureModuleDraft,
  isCommandIssue,
  moduleDraft,
  moduleInstanceIdSchema,
} from "./moduleDraft";

const instant = z.number().int().min(0).max(8_640_000_000_000_000);
const entryIds = z.array(inboxEntryIdSchema).min(1).max(INBOX_LIMITS.entries);

/**
 * Notification bookkeeping. None of it is undoable (ADR 011): it lives in its own module record,
 * so alerts can fire between calendar edits without breaking undo. Instants come in the payload.
 */
export const inboxCommandHandlers = [
  defineCommandHandler({
    type: "inbox.alerts.record",
    label: "Record alerts",
    history: "ignore",
    payloadSchema: z
      .object({
        instanceId: moduleInstanceIdSchema,
        entries: z.array(inboxEntrySchema).max(INBOX_LIMITS.entries),
        fired: z.record(z.string().min(1).max(INBOX_LIMITS.alertKeyLength), instant),
        scannedThrough: instant,
        now: instant,
      })
      .strict(),
    apply(document, payload) {
      const inbox = ensureModuleDraft(document, inboxDocumentModule, payload.instanceId, () =>
        emptyInboxModule(payload.scannedThrough),
      );
      if (isCommandIssue(inbox)) return [inbox];
      for (const entry of payload.entries) {
        if (inbox.entries[entry.id]) return [commandRejected("payload.entries", "Entry exists")];
        inbox.entries[entry.id] = entry;
      }
      Object.assign(inbox.fired, payload.fired);
      inbox.scannedThrough = Math.max(inbox.scannedThrough, payload.scannedThrough);
      prune(inbox, payload.now);
    },
  }),
  defineCommandHandler({
    type: "inbox.entries.mark-read",
    label: "Mark notifications read",
    history: "ignore",
    payloadSchema: z.object({ ids: entryIds }).strict(),
    apply(document, { ids }) {
      const inbox = moduleDraft(document, inboxDocumentModule);
      for (const id of ids) {
        const entry = inbox?.entries[id];
        if (entry && !entry.read) entry.read = true;
      }
    },
  }),
  defineCommandHandler({
    type: "inbox.entries.dismiss",
    label: "Dismiss notifications",
    history: "ignore",
    payloadSchema: z.object({ ids: entryIds }).strict(),
    apply(document, { ids }) {
      const inbox = moduleDraft(document, inboxDocumentModule);
      for (const id of ids) if (inbox?.entries[id]) delete inbox.entries[id];
    },
  }),
  defineCommandHandler({
    type: "inbox.clear-all",
    label: "Clear notifications",
    history: "ignore",
    payloadSchema: z.object({}).strict(),
    apply(document) {
      const inbox = moduleDraft(document, inboxDocumentModule);
      if (inbox && Object.keys(inbox.entries).length > 0) inbox.entries = {};
    },
  }),
  defineCommandHandler({
    type: "inbox.entry.snooze",
    label: "Snooze notification",
    history: "ignore",
    payloadSchema: z.object({ id: inboxEntryIdSchema, until: instant }).strict(),
    apply(document, { id, until }) {
      const entry = moduleDraft(document, inboxDocumentModule)?.entries[id];
      if (!entry) return [commandRejected("payload.id", "No such notification")];
      entry.snoozedUntil = until;
      entry.read = false;
    },
  }),
  defineCommandHandler({
    type: "inbox.watermark.advance",
    label: "Advance alert scan",
    history: "ignore",
    payloadSchema: z
      .object({ instanceId: moduleInstanceIdSchema, scannedThrough: instant })
      .strict(),
    apply(document, { instanceId, scannedThrough }) {
      const inbox = ensureModuleDraft(document, inboxDocumentModule, instanceId, () =>
        emptyInboxModule(scannedThrough),
      );
      if (isCommandIssue(inbox)) return [inbox];
      if (scannedThrough > inbox.scannedThrough) inbox.scannedThrough = scannedThrough;
    },
  }),
] as const satisfies readonly DomainCommandHandler[];

/** Keeps the inbox within its budget: old fired keys are forgotten, the oldest entries go first. */
function prune(inbox: InboxModule, now: number) {
  const forgetBefore = now - INBOX_LIMITS.firedRetentionMs;
  for (const [key, firedAt] of Object.entries(inbox.fired)) {
    if (firedAt < forgetBefore) delete inbox.fired[key];
  }
  const oldestFirst = <Item>(record: Record<string, Item>, at: (item: Item) => number) =>
    Object.entries(record).sort(([, left], [, right]) => at(left) - at(right));
  const extraFired = Object.keys(inbox.fired).length - INBOX_LIMITS.firedAlerts;
  for (const [key] of oldestFirst(inbox.fired, (firedAt) => firedAt).slice(
    0,
    Math.max(0, extraFired),
  )) {
    delete inbox.fired[key];
  }
  const extraEntries = Object.keys(inbox.entries).length - INBOX_LIMITS.entries;
  for (const [id] of oldestFirst(inbox.entries, (entry) => entry.firedAt).slice(
    0,
    Math.max(0, extraEntries),
  )) {
    delete inbox.entries[id];
  }
}
