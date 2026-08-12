// @vitest-environment node
import { describe, expect, it } from "vitest";
import { coreDocumentCommandHandlers } from "./coreDocumentCommandHandlers";

describe("core document command registry", () => {
  it("declares the complete Phase 3B command inventory and history policy", () => {
    expect(coreDocumentCommandHandlers.map(({ type, history }) => [type, history])).toEqual([
      ["document.canvas.create", "record"],
      ["document.canvas.rename", "record"],
      ["document.canvas.update-settings", "record"],
      ["document.canvas.update", "record"],
      ["document.canvas.set-active", "ignore"],
      ["document.canvas.reorder", "record"],
      ["document.canvas.remove", "record"],
      ["document.element.insert", "record"],
      ["document.element.update-geometry", "record"],
      ["document.element.replace-data", "record"],
      ["document.element.reorder", "record"],
      ["document.element.remove", "record"],
      ["document.connection.insert", "record"],
      ["document.connection.replace-data", "record"],
      ["document.connection.remove", "record"],
      ["document.media.register", "record"],
      ["document.media.update-metadata", "record"],
      ["document.media.remove", "record"],
      ["document.extension.install", "record"],
      ["document.extension.set-enabled", "record"],
      ["document.extension.replace-configuration", "record"],
      ["document.extension.remove", "record"],
      ["document.settings.update", "record"],
    ]);
  });
});
