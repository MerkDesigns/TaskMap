import type { MediaReference, TaskMapDocument } from "../../domain/document/documentTypes";
import {
  imageMediaReferenceSchema,
  type ImageMediaMetadata,
} from "../../elements/image/imageModel";
import type { RetainedCanvasProjectionIssue } from "./retainedCanvasProjectionTypes";

export function createImageMediaProjection() {
  let cache = new WeakMap<MediaReference, ImageMediaMetadata>();
  let previousReferences: TaskMapDocument["mediaReferences"] | undefined;
  let previousResult: ReturnType<typeof projectUncached> | undefined;

  function projectUncached(references: TaskMapDocument["mediaReferences"]) {
    const byId = new Map<string, ImageMediaMetadata>();
    const issues: RetainedCanvasProjectionIssue[] = [];
    for (const reference of Object.values(references)) {
      let metadata = cache.get(reference);
      if (!metadata) {
        const result = imageMediaReferenceSchema.safeParse(reference);
        if (!result.success) {
          issues.push({ code: "invalid-image-media", mediaId: reference.id });
          continue;
        }
        metadata = Object.freeze(result.data);
        cache.set(reference, metadata);
      }
      byId.set(reference.id, metadata);
    }
    return { byId, issues, metadata: Object.freeze([...byId.values()]) };
  }

  function project(references: TaskMapDocument["mediaReferences"]) {
    if (references === previousReferences && previousResult) return previousResult;
    previousResult = projectUncached(references);
    previousReferences = references;
    return previousResult;
  }

  function clear() {
    cache = new WeakMap();
    previousReferences = undefined;
    previousResult = undefined;
  }
  return { project, clear };
}
