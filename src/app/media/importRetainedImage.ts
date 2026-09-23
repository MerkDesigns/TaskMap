import type { RetainedActionCallbacks } from "../commands/createRetainedActionCallbacks";
import type { createSessionMediaResources } from "./createSessionMediaResources";
import { imageElementSchema, type ImageDocumentElement } from "../../elements/image/imageModel";

export async function importRetainedImage(
  actions: RetainedActionCallbacks,
  media: Pick<ReturnType<typeof createSessionMediaResources>, "import">,
  source: Blob | null,
  input: ImageDocumentElement,
) {
  const parsed = imageElementSchema.safeParse(input);
  if (!parsed.success || parsed.data.data.placement !== null || parsed.data.data.mediaId !== null)
    return { ok: false as const, code: "invalid-action" as const };
  const captured = actions.captureImageImport();
  if (!captured) return { ok: false as const, code: "expired-action" as const };
  try {
    const stored = await media.import(source);
    if (!stored.ok) {
      captured.cancel();
      return stored;
    }
    return captured.complete({
      media: stored.value,
      element: { ...parsed.data, data: { ...parsed.data.data, mediaId: stored.value.id } },
    });
  } catch {
    captured.cancel();
    return { ok: false as const, code: "invalid-action" as const };
  }
  // Rejected insertion can leave unreferenced bytes. Do not remove bytes needed by history or
  // introduce opportunistic GC here; document changes remain one all-or-nothing transaction.
}
