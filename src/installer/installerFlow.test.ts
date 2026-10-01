import { describe, expect, it } from "vitest";
import type { InstallerDetails } from "../platform/installer/installerClient";
import { compareVersions, initialInstallerState, installerReducer } from "./installerFlow";

const details = (existing: InstallerDetails["existing"] = null): InstallerDetails => ({
  productName: "TaskMap",
  version: "0.3.4",
  defaultLocation: String.raw`C:\Users\me\AppData\Local\TaskMap`,
  existing,
  legacyInstalled: false,
  simulated: false,
});

describe("installer flow", () => {
  it("starts a fresh install on the welcome screen at the default location", () => {
    const state = installerReducer(initialInstallerState, { type: "loaded", details: details() });

    expect(state.screen).toEqual({ name: "welcome" });
    expect(state.options.location).toBe(details().defaultLocation);
  });

  it("offers an update in the existing installation's folder", () => {
    const existing = { version: "0.3.2", location: String.raw`D:\Apps\TaskMap`, executable: "" };
    const state = installerReducer(initialInstallerState, {
      type: "loaded",
      details: details(existing),
    });

    expect(state.screen).toEqual({ name: "update" });
    expect(state.options.location).toBe(existing.location);
  });

  it("stops on the legacy guard instead of offering to replace the legacy app", () => {
    const existing = { version: "0.3.4", location: String.raw`C:\TaskMap`, executable: "" };
    const state = installerReducer(initialInstallerState, {
      type: "loaded",
      details: { ...details(existing), legacyInstalled: true },
    });

    expect(state.screen).toEqual({ name: "legacyInstalled" });
    expect(installerReducer(state, { type: "back" }).screen).toEqual({ name: "legacyInstalled" });
  });

  it("returns from the options to the screen it came from", () => {
    let state = installerReducer(initialInstallerState, { type: "loaded", details: details() });
    state = installerReducer(state, { type: "showOptions" });
    state = installerReducer(state, { type: "setShortcut", shortcut: "desktop", on: false });
    state = installerReducer(state, { type: "back" });

    expect(state.screen).toEqual({ name: "welcome" });
    expect(state.options.desktopShortcut).toBe(false);
  });

  it("follows install stages only while installing", () => {
    let state = installerReducer(initialInstallerState, { type: "loaded", details: details() });
    expect(installerReducer(state, { type: "stage", stage: "installing" })).toBe(state);

    state = installerReducer(state, { type: "start" });
    state = installerReducer(state, { type: "stage", stage: "installing" });
    expect(state.screen).toEqual({ name: "installing", stage: "installing" });
  });

  it("compares dotted versions numerically", () => {
    expect(compareVersions("0.3.10", "0.3.9")).toBe(1);
    expect(compareVersions("0.3.4", "0.3.4")).toBe(0);
    expect(compareVersions("0.3", "0.3.1")).toBe(-1);
  });
});
