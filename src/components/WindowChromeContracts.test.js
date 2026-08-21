// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = new URL("../App.tsx", import.meta.url);
const componentPath = new URL("./WindowChrome.tsx", import.meta.url);
const cssPath = new URL("../ui/patterns/workspace/WindowChrome.css", import.meta.url);
const clientPath = new URL("../platform/window/tauriWindowChromeClient.ts", import.meta.url);
const configPath = new URL("../../src-tauri/tauri.conf.json", import.meta.url);
const developmentConfigPath = new URL("../../src-tauri/tauri.dev.conf.json", import.meta.url);
const capabilityPath = new URL("../../src-tauri/capabilities/default.json", import.meta.url);

describe("frameless window chrome contracts", () => {
  it("disables decorations while preserving native resizing", async () => {
    const [stableConfig, developmentConfig] = await Promise.all([
      readFile(configPath, "utf8").then(JSON.parse),
      readFile(developmentConfigPath, "utf8").then(JSON.parse),
    ]);

    for (const config of [stableConfig, developmentConfig]) {
      expect(config.app.windows[0].decorations).toBe(false);
      expect(config.app.windows[0].resizable).toBe(true);
    }
  });

  it("keeps Tauri APIs in the platform adapter with explicit permissions", async () => {
    const [componentSource, clientSource, capabilitySource] = await Promise.all([
      readFile(componentPath, "utf8"),
      readFile(clientPath, "utf8"),
      readFile(capabilityPath, "utf8"),
    ]);
    const capability = JSON.parse(capabilitySource);

    expect(componentSource).not.toContain("@tauri-apps/");
    expect(clientSource).toContain("@tauri-apps/api/window");
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        "core:window:allow-close",
        "core:window:allow-is-maximized",
        "core:window:allow-minimize",
        "core:window:allow-start-dragging",
        "core:window:allow-toggle-maximize",
      ]),
    );
  });

  it("mounts transparent drag chrome and a separate Acrylic Large control island", async () => {
    const [appSource, componentSource, cssSource] = await Promise.all([
      readFile(appPath, "utf8"),
      readFile(componentPath, "utf8"),
      readFile(cssPath, "utf8"),
    ]);

    expect(appSource).toMatch(
      /<WorkspaceChromeLayer>[\s\S]*<WindowChrome radius=\{workspaceGeometryValues\.topBarRadius\}\s*\/>[\s\S]*<FloatingToolbar/,
    );
    expect(appSource).toContain("toolbarRadius={workspaceGeometryValues.topBarRadius}");
    expect(componentSource).toContain('material="acrylic-large"');
    expect(componentSource).toContain('elevation="none"');
    expect(componentSource).toContain('aria-label="Window controls"');
    expect(componentSource).toContain("onPointerDown={stopChromePointerPropagation}");
    expect(cssSource).not.toMatch(/\.taskmap-window-drag-region\s*\{[^}]*background/s);
    expect(cssSource).toMatch(
      /\.taskmap-window-drag-region\s*\{[^}]*top:\s*0;[^}]*right:\s*0;[^}]*left:\s*0;/s,
    );
    expect(cssSource).toContain(
      "height: calc(var(--taskmap-chrome-inset-top) + var(--taskmap-toolbar-height))",
    );
    expect(cssSource).toMatch(/\.taskmap-window-controls\s*\{[^}]*right:/s);
    expect(cssSource).toContain("var(--taskmap-material-radius)");
  });
});
