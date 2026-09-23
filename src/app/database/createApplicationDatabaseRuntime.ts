import type { createTauriApplicationDatabase } from "../../platform/database/tauriApplicationDatabase";
import type { PersistenceScheduler } from "../persistence/persistenceScheduler";
import { createDatabaseSessionController } from "./createDatabaseSessionController";
import { acceptRetainedDocument } from "./acceptRetainedDocument";
import { retainedDocumentCommandHandlers } from "../commands/retainedDocumentCommandHandlers";
import { createRetainedActionCallbacks } from "../commands/createRetainedActionCallbacks";
import { createDevicePreferences } from "../preferences/createDevicePreferences";
import { createRememberedViews } from "../preferences/createRememberedViews";
import { createSessionMediaResources } from "../media/createSessionMediaResources";
import { importRetainedImage } from "../media/importRetainedImage";
import type { ImageDocumentElement } from "../../elements/image/imageModel";
import { createRetainedCanvasBinding } from "../view-projection/createRetainedCanvasBinding";
import { createWindowPrivacy } from "../preferences/createWindowPrivacy";
import type { WindowPrivacyClient } from "../../platform/window/windowPrivacyClient";
import { clearDatabaseResources, createDatabaseRuntimeResources } from "./databaseRuntimeResources";

type Platform = Extract<
  Awaited<ReturnType<typeof createTauriApplicationDatabase>>,
  { ok: true }
>["value"];
export interface DatabaseRuntimeOptions {
  readonly purgeDocumentResources: () => void;
  readonly scheduler?: PersistenceScheduler;
  readonly windowPrivacyClient?: WindowPrivacyClient;
}

/** Shared production composition. The caller provides either native adapters or an isolated test transport. */
export function createApplicationDatabaseRuntime(
  platform: Platform,
  options: DatabaseRuntimeOptions,
) {
  let canvasBinding: ReturnType<typeof createRetainedCanvasBinding> | null = null;
  const resources = createDatabaseRuntimeResources();
  const controller = createDatabaseSessionController({
    ...options,
    ...platform,
    acceptDocument: acceptRetainedDocument,
    commandHandlers: retainedDocumentCommandHandlers,
    flushDocumentResources: resources.flush,
    purgeDocumentResources: resources.purge,
  });
  const callbacks = createRetainedActionCallbacks(controller);
  const preferences = createDevicePreferences(platform.preferencesClient);
  const views = createRememberedViews(controller, platform.preferencesClient, options.scheduler);
  const media = createSessionMediaResources(controller, platform.mediaClient);
  const privacy = createWindowPrivacy(
    options.windowPrivacyClient ?? {
      async setProtected() {
        return { ok: true, value: undefined };
      },
    },
    preferences,
    () => {
      void controller.cancel();
    },
  );
  const disposeController = controller.dispose;
  resources.attach({
    async flush() {
      const savedViews = await views.flush();
      return savedViews.ok ? preferences.flush() : savedViews;
    },
    purge() {
      clearDatabaseResources([
        callbacks.clear,
        views.clear,
        media.clear,
        () => canvasBinding?.clear(),
        options.purgeDocumentResources,
      ]);
    },
    dispose() {
      clearDatabaseResources([
        callbacks.dispose,
        views.dispose,
        media.dispose,
        preferences.dispose,
        privacy.dispose,
      ]);
    },
  });
  return {
    ok: true as const,
    value: {
      controller: {
        ...controller,
        dispose: async () => {
          try {
            return await disposeController();
          } finally {
            resources.dispose();
          }
        },
      },
      callbacks,
      preferences,
      privacy,
      views,
      media,
      importImage: (source: Blob | null, element: ImageDocumentElement) =>
        importRetainedImage(callbacks, media, source, element),
      async initializeResources() {
        const loaded = await preferences.load();
        if (!loaded.ok) return loaded;
        const protectedWindow = await privacy.initialize();
        return protectedWindow.ok ? views.load() : protectedWindow;
      },
      bindCanvas(
        input: Omit<
          Parameters<typeof createRetainedCanvasBinding>[0],
          "actions" | "session" | "views"
        >,
      ) {
        if (canvasBinding) throw new Error("The session already has a mounted canvas binding.");
        canvasBinding = createRetainedCanvasBinding({
          ...input,
          session: controller,
          views,
          actions: callbacks,
          onRevoke() {
            input.onRevoke();
            canvasBinding = null;
          },
        });
        return canvasBinding;
      },
      settingsClient: platform.settingsClient,
      edition: platform.edition,
    },
  };
}
