import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Liquid DOM fixture entrypoint", () => {
  it("is lazy, development-only, and selected ahead of the production shell", async () => {
    const source = await readFile("src/main.tsx", "utf8");

    expect(source).toContain("import.meta.env.DEV");
    expect(source).toContain('import.meta.env.VITE_TASKMAP_LIQUID_DOM_FIXTURE === "1"');
    expect(source).toContain('import("./ui/dev/LiquidDomVerificationFixture")');
    expect(source).toContain("DevelopmentLiquidDomFixture ?");
  });

  it("loads the postinstall-patched Liquid DOM package without a stale Vite prebundle", async () => {
    const source = await readFile("config/vite.config.ts", "utf8");

    expect(source).toContain('exclude: ["@liquid-dom/core"]');
  });
});
