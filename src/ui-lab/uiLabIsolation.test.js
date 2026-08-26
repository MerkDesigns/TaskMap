// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

describe("isolated UI Lab entry", () => {
  it("mounts only the dedicated UI Lab bootstrap", async () => {
    const [html, main] = await Promise.all([read("ui-lab.html"), read("src/ui-lab/main.tsx")]);

    expect(html).toContain('id="ui-lab-root"');
    expect(html).toContain('src="/src/ui-lab/main.tsx"');
    expect(html).not.toContain("/src/main.tsx");
    expect(main).toContain('from "./UiLabApp"');
    expect(main).not.toMatch(/AppShell|LegacyApplication/);
  });

  it("does not import product application, state, persistence, database, or platform modules", async () => {
    const sources = await Promise.all(
      [
        "src/ui-lab/main.tsx",
        "src/ui-lab/UiLabApp.tsx",
        "src/ui-lab/SurfaceMaterialPrototype.tsx",
        "src/ui-lab/system/Material.ts",
        "src/ui-lab/system/Surface.tsx",
      ].map(read),
    );
    const imports = sources.flatMap((source) =>
      [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]),
    );

    expect(imports).not.toContain("../main");
    expect(imports).not.toContain("../app/AppShell");
    expect(imports).not.toContain("../legacy/LegacyApplication");
    expect(imports).not.toContain("../app/AppProviders");
    expect(imports).not.toContain("react-redux");
    expect(imports).not.toContain("@reduxjs/toolkit");
    expect(imports).not.toContain("@tauri-apps/api");
    expect(
      imports.some((specifier) =>
        /(?:^|\/)(?:platform|persistence|database)(?:\/|$)/.test(specifier),
      ),
    ).toBe(false);
  });

  it("uses the current production material boundary for exactly four samples", async () => {
    const source = await read("src/ui-lab/UiLabApp.tsx");

    expect(source).toContain('from "../ui/materials/MaterialSurface"');
    expect(source.match(/<MaterialSurface\b/g)).toHaveLength(4);
    for (const material of ["acrylic-large", "acrylic-small", "opaque", "cutout"]) {
      expect(source).toContain(`material="${material}"`);
    }
    expect(source).not.toMatch(/backdrop-filter|major-glass|minor-glass|VisualGroup/);
  });

  it("keeps the Tauri Lab configuration isolated and development-only", async () => {
    const [packageSource, configSource, capabilitySource, cargo, rust] = await Promise.all([
      read("package.json"),
      read("src-tauri/tauri.ui-lab.conf.json"),
      read("src-tauri/capabilities/ui-lab-window.json"),
      read("src-tauri/Cargo.toml"),
      read("src-tauri/src/main.rs"),
    ]);
    const packageJson = JSON.parse(packageSource);
    const config = JSON.parse(configSource);
    const capability = JSON.parse(capabilitySource);

    expect(packageJson.scripts["dev:ui-lab"]).toContain("--port 6970");
    expect(packageJson.scripts["app:ui-lab"]).toContain("tauri dev");
    expect(packageJson.scripts["app:ui-lab"]).toContain("ui-lab-development");
    expect(config.productName).toBe("TaskMap UI Lab");
    expect(config.identifier).toBe("com.merkdesigns.taskmap.ui-lab");
    expect(config.build.devUrl).toBe("http://127.0.0.1:6970/ui-lab.html");
    expect(config.app.security.capabilities).toEqual(["mcp-development", "ui-lab-window"]);
    expect(capability).toMatchObject({
      identifier: "ui-lab-window",
      windows: ["main"],
      permissions: [
        "core:event:allow-listen",
        "core:event:allow-unlisten",
        "core:window:allow-close",
        "core:window:allow-is-maximized",
        "core:window:allow-minimize",
        "core:window:allow-start-dragging",
        "core:window:allow-toggle-maximize",
      ],
    });
    expect(config.app.security.capabilities).not.toContain("default");
    expect(config.app.windows[0]).toMatchObject({
      width: 1280,
      height: 820,
      minWidth: 960,
      minHeight: 640,
    });
    expect(config.bundle).toMatchObject({ active: false, createUpdaterArtifacts: false });
    expect(config.plugins.updater).toBeNull();
    expect(cargo).toContain("ui-lab-development = []");
    expect(rust).toContain('cfg!(feature = "ui-lab-development")');
    expect(rust).toContain('#[cfg(not(feature = "ui-lab-development"))]');
    expect(rust).toContain("TaskMap UI Lab: product storage and session lifecycle disabled");

    const setupGuard = rust.indexOf('if cfg!(feature = "ui-lab-development")');
    const storageStartup = rust.indexOf("initialize_storage(app.handle())");
    const windowEvents = rust.indexOf(".on_window_event");
    const closeGuard = rust.indexOf('if cfg!(feature = "ui-lab-development")', windowEvents);
    const savedWindow = rust.indexOf("save_window_state(window)", windowEvents);
    expect(setupGuard).toBeGreaterThan(-1);
    expect(setupGuard).toBeLessThan(storageStartup);
    expect(closeGuard).toBeGreaterThan(windowEvents);
    expect(closeGuard).toBeLessThan(savedWindow);
  });

  it("keeps ordinary development and production commands free of Lab and MCP features", async () => {
    const [packageSource, stableSource, developmentSource, cargo] = await Promise.all([
      read("package.json"),
      read("src-tauri/tauri.conf.json"),
      read("src-tauri/tauri.dev.conf.json"),
      read("src-tauri/Cargo.toml"),
    ]);
    const scripts = JSON.parse(packageSource).scripts;
    const ordinaryCommands = [
      "dev",
      "build",
      "app:dev",
      "app:stable",
      "bundle:dev",
      "bundle:stable",
    ];

    for (const name of ordinaryCommands) {
      expect(scripts[name]).not.toMatch(/ui-lab|mcp-development|tauri\.ui-lab/);
    }
    expect(stableSource).not.toMatch(/ui-lab-development|mcp-development/);
    expect(developmentSource).not.toMatch(/ui-lab-development|mcp-development/);
    expect(cargo).toContain("default = []");
  });
});
