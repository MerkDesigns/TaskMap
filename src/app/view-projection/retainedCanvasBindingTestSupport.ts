import { vi } from "vitest";
import { createViewport } from "../../canvas/geometry/viewportMath";
import { callbackSetup } from "../commands/retainedCallbackTestSupport";
import { createRememberedViews } from "../preferences/createRememberedViews";
import { preferencesClientFixture } from "../preferences/preferencesTestSupport";
import { createRetainedCanvasBinding } from "./createRetainedCanvasBinding";

export async function canvasBindingSetup() {
  const setup = await callbackSetup();
  const { client, view } = preferencesClientFixture();
  const views = createRememberedViews(setup.controller, client, setup.scheduler);
  await views.load();
  const onRevoke = vi.fn();
  const options = {
    session: setup.controller,
    views,
    actions: setup.actions,
    viewport: createViewport({ x: 0, y: 0 }, 1, { width: 1000, height: 800 }),
    onRevoke,
  };
  const binding = createRetainedCanvasBinding(options);
  return {
    ...setup,
    binding,
    options,
    views,
    view,
    onRevoke,
    async dispose() {
      binding.dispose();
      views.dispose();
      await setup.dispose();
    },
  };
}
