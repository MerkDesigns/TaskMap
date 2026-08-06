// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  COMMAND_TEST_IDS,
  createCommandTestDocument,
  executeTestCommand,
} from "../commandTestSupport";

describe("media, extension, and settings commands", () => {
  it("registers, updates allowed metadata, and removes media references", () => {
    let document = createCommandTestDocument();
    document = succeed(document, "document.media.register", {
      media: {
        id: COMMAND_TEST_IDS.mediaB,
        mimeType: "image/gif",
        byteLength: 20,
        pixelWidth: 2,
        pixelHeight: 3,
        altText: null,
      },
    });
    document = succeed(document, "document.media.update-metadata", {
      mediaId: COMMAND_TEST_IDS.mediaB,
      metadata: { altText: "Animated chart", pixelWidth: 4 },
    });
    expect(document.mediaReferences[COMMAND_TEST_IDS.mediaB]).toMatchObject({
      altText: "Animated chart",
      pixelWidth: 4,
      mimeType: "image/gif",
    });
    document = succeed(document, "document.media.remove", {
      mediaId: COMMAND_TEST_IDS.mediaB,
    });
    expect(document.mediaReferences[COMMAND_TEST_IDS.mediaB]).toBeUndefined();
  });

  it("rejects private media fields and malformed metadata", () => {
    const document = createCommandTestDocument();
    for (const media of [
      {
        id: COMMAND_TEST_IDS.mediaB,
        mimeType: "image/png",
        byteLength: 1,
        pixelWidth: null,
        pixelHeight: null,
        altText: null,
        filename: "private.png",
      },
      {
        id: COMMAND_TEST_IDS.mediaB,
        mimeType: "not-a-mime",
        byteLength: 1,
        pixelWidth: null,
        pixelHeight: null,
        altText: null,
      },
    ]) {
      const result = executeTestCommand(document, {
        type: "document.media.register",
        payload: { media },
      });
      expect(result.ok).toBe(false);
      expect(result.document).toBe(document);
    }
  });

  it("installs, updates, disables, and removes an extension installation", () => {
    let document = createCommandTestDocument();
    document = succeed(document, "document.extension.install", {
      installation: {
        id: COMMAND_TEST_IDS.extensionC,
        extensionId: "privacy",
        target: { kind: "canvas", canvasId: COMMAND_TEST_IDS.canvasA },
        enabled: true,
        configuration: { blur: 4 },
      },
    });
    document = succeed(document, "document.extension.set-enabled", {
      installationId: COMMAND_TEST_IDS.extensionC,
      enabled: false,
    });
    document = succeed(document, "document.extension.replace-configuration", {
      installationId: COMMAND_TEST_IDS.extensionC,
      configuration: { blur: 8 },
    });
    expect(document.extensionInstallations[COMMAND_TEST_IDS.extensionC]).toMatchObject({
      enabled: false,
      configuration: { blur: 8 },
    });
    document = succeed(document, "document.extension.remove", {
      installationId: COMMAND_TEST_IDS.extensionC,
    });
    expect(document.extensionInstallations[COMMAND_TEST_IDS.extensionC]).toBeUndefined();
  });

  it("rejects missing targets, duplicate installations, and unsafe configuration", () => {
    const document = createCommandTestDocument();
    const missingTarget = executeTestCommand(document, {
      type: "document.extension.install",
      payload: {
        installation: {
          id: COMMAND_TEST_IDS.extensionC,
          extensionId: "privacy",
          target: { kind: "canvas", canvasId: COMMAND_TEST_IDS.canvasB },
          enabled: true,
          configuration: {},
        },
      },
    });
    const duplicate = executeTestCommand(document, {
      type: "document.extension.install",
      payload: {
        installation: {
          id: COMMAND_TEST_IDS.extensionC,
          extensionId: "checkbox",
          target: { kind: "element", elementId: COMMAND_TEST_IDS.elementA },
          enabled: true,
          configuration: {},
        },
      },
    });
    const unsafeConfiguration = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(unsafeConfiguration, "value", { get: () => "secret", enumerable: true });
    const unsafe = executeTestCommand(document, {
      type: "document.extension.replace-configuration",
      payload: {
        installationId: COMMAND_TEST_IDS.extensionA,
        configuration: unsafeConfiguration,
      },
    });

    expect(missingTarget.ok).toBe(false);
    expect(duplicate.ok).toBe(false);
    expect(unsafe.ok).toBe(false);
    expect(unsafe.ok ? [] : unsafe.issues).toContainEqual(
      expect.objectContaining({ code: "command-payload" }),
    );
  });

  it("updates only supported persistent document settings", () => {
    const document = createCommandTestDocument();
    const updated = succeed(document, "document.settings.update", {
      settings: {
        grid: { style: "lines", opacityPercent: { lines: 25 } },
        showElementShadows: true,
      },
    });
    expect(updated.documentSettings).toMatchObject({
      grid: { style: "lines", opacityPercent: { dots: 50, lines: 25 } },
      showElementShadows: true,
    });
    const unsupported = executeTestCommand(updated, {
      type: "document.settings.update",
      payload: { settings: { theme: "private" } },
    });
    expect(unsupported.ok).toBe(false);
  });
});

function succeed(
  document: ReturnType<typeof createCommandTestDocument>,
  type: string,
  payload: unknown,
) {
  const result = executeTestCommand(document, { type, payload });
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join(", "));
  return result.document;
}
