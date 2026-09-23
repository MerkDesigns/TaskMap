// Offline generated-fixture contract: run the Python generator first to exercise each profile.
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateAppData } from "../src/app/appDataSchema";

for (const [profile, canvases, elements, images, minimumBytes] of [
  ["glass-normal-v1", 25, 2000, 500, 500_000_000],
  ["glass-smoke-v1", 2, 16, 4, 0],
]) {
  const base = path.resolve("fixtures", profile);
  const manifestFile = path.join(base, "manifest.json");
  describe.skipIf(!existsSync(manifestFile))(`${profile} prepared files`, () => {
    it("passes the active production schema and layout counts", () => {
      const data = readFileSync(path.join(base, "document.json"));
      const document = validateAppData(JSON.parse(data.toString()));
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      expect(createHash("sha256").update(data).digest("hex")).toBe(manifest.document.sha256);
      expect(document.canvases).toHaveLength(canvases);
      const all = document.canvases.flatMap((canvas) => [
        ...canvas.containers,
        ...canvas.textCards,
        ...canvas.textBlocks,
        ...canvas.images,
      ]);
      expect(all).toHaveLength(elements);
      expect(new Set(all.map((element) => element.id)).size).toBe(elements);
    });

    it("has real unique still/animated references, without claiming import or FPS", () => {
      const document = JSON.parse(readFileSync(path.join(base, "document.json"), "utf8"));
      const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
      const references = document.canvases.flatMap((canvas) =>
        canvas.images.map((image) => image.imageId),
      );
      expect(references).toHaveLength(images);
      expect(new Set(references)).toEqual(new Set(manifest.assets.map((asset) => asset.sha256)));
      expect(manifest.assets).toHaveLength(images);
      expect(manifest.mediaCount).toBe(images);
      expect(manifest.mediaBytes).toBeGreaterThanOrEqual(minimumBytes);
      expect(manifest.assets.some((asset) => asset.format === "gif" && asset.frames > 1)).toBe(
        true,
      );
      expect(manifest.assets.some((asset) => asset.format === "webp" && asset.frames === 1)).toBe(
        true,
      );
      expect(manifest.loadedIntoTaskMap).toBe(false);
      expect(manifest.releasePerformanceAccepted).toBe(false);
    });
  });
}
