import { isEntityId, type EntityIdKind } from "../../ids/entityIds";
import type { TaskMapDocument } from "../documentTypes";
import type { DocumentInvariantIssue } from "../documentInvariants";

type EntityRecord = Readonly<Record<string, { readonly id: string }>>;

export function inspectEntityRecordInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  const issues: DocumentInvariantIssue[] = [];
  inspectRecord(document.canvases, "canvases", "canvas", issues);
  inspectRecord(document.elements, "elements", "element", issues);
  inspectRecord(document.connections, "connections", "connection", issues);
  inspectRecord(document.mediaReferences, "mediaReferences", "media", issues);
  inspectRecord(
    document.extensionInstallations,
    "extensionInstallations",
    "extension-instance",
    issues,
  );
  return issues;
}

function inspectRecord(
  entities: EntityRecord,
  collection: string,
  kind: EntityIdKind,
  issues: DocumentInvariantIssue[],
) {
  const seenIds = new Set<string>();
  for (const [key, entity] of Object.entries(entities)) {
    if (!isEntityId(kind, key)) {
      issues.push({
        code: "entity-key-malformed",
        path: `${collection}.${key}`,
        message: `${collection} key ${key} is not a valid ${kind} ID`,
      });
    }
    if (key !== entity.id) {
      issues.push({
        code: "entity-key-mismatch",
        path: `${collection}.${key}`,
        message: `${collection} key ${key} does not match entity ID ${entity.id}`,
      });
    }
    if (seenIds.has(entity.id)) {
      issues.push({
        code: "entity-id-duplicate",
        path: `${collection}.${key}.id`,
        message: `${collection} contains duplicate entity ID ${entity.id}`,
      });
    }
    seenIds.add(entity.id);
  }
}
