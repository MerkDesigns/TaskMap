import type { ExtensionInstallation, TaskMapDocument } from "../../domain/document/documentTypes";
import type { ElementId } from "../../domain/ids/entityIds";
import { findArchitectureExtensionDefinition } from "../../extensions/architectureRegistry";
import type {
  RetainedExtensionDefinition,
  RetainedExtensionView,
} from "../../extensions/retainedExtensionDefinition";
import type { RetainedCanvasProjectionIssue } from "./retainedCanvasProjectionTypes";

interface Entry {
  readonly source: ExtensionInstallation;
  readonly definition: RetainedExtensionDefinition;
  readonly installation: ExtensionInstallation;
  readonly view: RetainedExtensionView;
}
interface Group {
  readonly entries: readonly Entry[];
  readonly view: RetainedExtensionView;
}

export function createRetainedExtensionsProjection() {
  let cache = new WeakMap<ExtensionInstallation, Entry>();
  let previousGroups = new Map<ElementId, Group>();

  function clear() {
    cache = new WeakMap();
    previousGroups = new Map();
  }

  function project(document: TaskMapDocument) {
    const issues: RetainedCanvasProjectionIssue[] = [];
    const installations: ExtensionInstallation[] = [];
    const grouped = new Map<ElementId, Entry[]>();
    for (const source of Object.values(document.extensionInstallations)) {
      const extensionInstanceId = source.id;
      const definition = findArchitectureExtensionDefinition(source.extensionId);
      if (!definition) {
        issues.push({ code: "unsupported-extension", extensionInstanceId });
        continue;
      }
      if (
        source.target.kind !== "element" ||
        !definition.compatibleElementTypes.includes(
          document.elements[source.target.elementId]?.type,
        )
      ) {
        issues.push({ code: "incompatible-extension-target", extensionInstanceId });
        continue;
      }
      let entry = cache.get(source);
      if (!entry) {
        const parsed = definition.parseConfiguration(source.configuration);
        if (!parsed.ok) {
          issues.push({ code: "invalid-extension-configuration", extensionInstanceId });
          continue;
        }
        entry = {
          source,
          definition,
          view: parsed.view,
          installation: Object.freeze({
            ...source,
            target: Object.freeze({ ...source.target }),
            configuration: parsed.configuration,
          }),
        };
        cache.set(source, entry);
      }
      const elementId = source.target.elementId;
      const entries = grouped.get(elementId) ?? [];
      if (entries.some((other) => other.definition.id === definition.id)) {
        issues.push({ code: "duplicate-extension-installation", extensionInstanceId });
        continue;
      }
      if (
        entries.some(
          (other) =>
            definition.conflictsWith.includes(other.definition.id) ||
            other.definition.conflictsWith.includes(definition.id),
        )
      ) {
        issues.push({ code: "conflicting-extension-installation", extensionInstanceId });
        continue;
      }
      entries.push(entry);
      grouped.set(elementId, entries);
      installations.push(entry.installation);
    }
    const nextGroups = new Map<ElementId, Group>();
    const byElement = new Map<ElementId, RetainedExtensionView>();
    for (const [id, entries] of grouped) {
      const previous = previousGroups.get(id);
      const unchanged =
        previous?.entries.length === entries.length &&
        entries.every((entry, index) => entry === previous.entries[index]);
      const view = unchanged
        ? previous.view
        : (Object.freeze(
            Object.assign(
              {},
              ...entries.filter((entry) => entry.source.enabled).map((entry) => entry.view),
            ),
          ) as RetainedExtensionView);
      nextGroups.set(id, { entries, view });
      byElement.set(id, view);
    }
    previousGroups = nextGroups;
    return { byElement, installations: Object.freeze(installations), issues };
  }

  return { project, clear };
}
