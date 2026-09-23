import { getCurrentWindow } from "@tauri-apps/api/window";
import { z } from "zod";
export const imageDropSchema = z
  .object({
    tokens: z.array(z.string().min(1).max(128)).min(1).max(32),
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();
export type ImageDrop = z.infer<typeof imageDropSchema>;
export async function subscribeImageDrops(listener: (drop: ImageDrop) => void) {
  return getCurrentWindow().listen<unknown>("taskmap-image-drop", (event) => {
    const parsed = imageDropSchema.safeParse(event.payload);
    if (parsed.success) listener(parsed.data);
  });
}
