// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const mainPath = new URL("../../main.tsx", import.meta.url);

describe("development Mantine fixture gate", () => {
  it("requires development mode and an explicit environment flag", async () => {
    const source = await readFile(mainPath, "utf8");

    expect(source).toContain(
      'import.meta.env.DEV && import.meta.env.VITE_TASKMAP_MANTINE_FIXTURE === "1"',
    );
  });

  it("uses a lazy fixture entry instead of an eager production import", async () => {
    const source = await readFile(mainPath, "utf8");

    expect(source).toContain('import("./ui/dev/MantineVerificationFixture")');
    expect(source).not.toContain('import { MantineVerificationFixture } from "./ui/dev');
  });

  it("installs core styles and the provider at the application root", async () => {
    const source = await readFile(mainPath, "utf8");
    const coreStylesIndex = source.indexOf('import "@mantine/core/styles.css"');
    const applicationStylesIndex = source.indexOf('import "./index.css"');

    expect(coreStylesIndex).toBeGreaterThan(-1);
    expect(applicationStylesIndex).toBeGreaterThan(coreStylesIndex);
    expect(source).toContain("<TaskMapMantineProvider>");
    expect(source).toContain("<AppShell />");
  });
});
