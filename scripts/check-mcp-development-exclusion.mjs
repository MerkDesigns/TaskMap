import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const packageJson = await readJson("package.json");
const stableConfig = await readJson("src-tauri/tauri.conf.json");
const developmentConfig = await readJson("src-tauri/tauri.dev.conf.json");
const mcpDevelopmentConfig = await readJson("src-tauri/tauri.mcp.dev.conf.json");
const defaultCapability = await readFile("src-tauri/capabilities/default.json", "utf8");
const phase2Capability = await readFile("src-tauri/capabilities/phase2-development.json", "utf8");
const mcpCapability = await readFile(
  "src-tauri/capabilities/mcp-development/mcp-development.json",
  "utf8",
);
const cargoManifest = await readFile("src-tauri/Cargo.toml", "utf8");
const buildSource = await readFile("src-tauri/build.rs", "utf8");
const mainSource = await readFile("src-tauri/src/main.rs", "utf8");

const ordinaryCommands = ["app:stable", "bundle:stable", "app:dev", "bundle:dev"];
for (const command of ordinaryCommands) {
  const script = packageJson.scripts[command];
  if (
    !script ||
    script.includes("mcp-development") ||
    script.includes("ui-lab-development") ||
    script.includes("tauri.mcp.dev.conf.json") ||
    script.includes("tauri.ui-lab.conf.json") ||
    script.includes("withGlobalTauri")
  ) {
    throw new Error(`${command} must not enable the MCP development configuration`);
  }
}

for (const [name, config] of [
  ["stable", stableConfig],
  ["ordinary development", developmentConfig],
]) {
  if (config.app?.withGlobalTauri === true) {
    throw new Error(`${name} configuration enables withGlobalTauri`);
  }
  if (JSON.stringify(config).includes("mcp-development")) {
    throw new Error(`${name} configuration enables the MCP development capability`);
  }
  if (JSON.stringify(config).includes("ui-lab-development")) {
    throw new Error(`${name} configuration enables the UI Lab development feature`);
  }
}

const mcpScript = packageJson.scripts["app:dev:mcp"];
if (
  !mcpScript?.includes("--features phase2-development,mcp-development") ||
  !mcpScript.includes("--config src-tauri/tauri.mcp.dev.conf.json")
) {
  throw new Error("app:dev:mcp does not enable the isolated MCP feature and configuration");
}
if (
  mcpDevelopmentConfig.identifier !== "com.merkdesigns.taskmap.dev" ||
  mcpDevelopmentConfig.app?.withGlobalTauri !== true ||
  !mcpDevelopmentConfig.app?.security?.capabilities?.includes("mcp-development")
) {
  throw new Error("MCP development configuration is missing its development-only contract");
}
if (defaultCapability.includes("mcp-bridge") || phase2Capability.includes("mcp-bridge")) {
  throw new Error("an ordinary application capability exposes the MCP bridge");
}
if (!mcpCapability.includes('"mcp-bridge:default"')) {
  throw new Error("MCP development capability does not grant the bridge permission set");
}
if (
  !buildSource.includes('var_os("CARGO_FEATURE_MCP_DEVELOPMENT")') ||
  !buildSource.includes('"./capabilities/**/*.json"') ||
  !buildSource.includes('"./capabilities/*.json"')
) {
  throw new Error("Tauri capability discovery is not gated by the MCP Cargo feature");
}
if (
  !cargoManifest.includes('mcp-development = ["dep:tauri-plugin-mcp-bridge"]') ||
  !cargoManifest.includes('tauri-plugin-mcp-bridge = { version = "=0.12.0", optional = true }')
) {
  throw new Error("MCP bridge Cargo dependency is not optional and feature-gated");
}
if (
  !mainSource.includes('#[cfg(all(debug_assertions, feature = "mcp-development"))]') ||
  !mainSource.includes('.bind_address("127.0.0.1")')
) {
  throw new Error("MCP bridge registration is not debug-and-feature gated on localhost");
}

console.log("Stable and ordinary development configurations exclude the MCP bridge.");
