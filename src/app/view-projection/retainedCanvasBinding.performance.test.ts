import { expect, it, vi } from "vitest";
import { canvasBindingSetup } from "./retainedCanvasBindingTestSupport";
import { pointer } from "../interactions/retainedInteractionTestSupport";

it("keeps 200 camera samples outside view projection, React notifications and document persistence", async () => {
  const setup = await canvasBindingSetup();
  const serialize = vi.spyOn(JSON, "stringify");
  try {
    const { binding, store, views, view, client } = setup;
    const snapshot = binding.getSnapshot();
    const workspace = store.getState().documentWorkspace;
    const notify = vi.fn();
    binding.subscribe(notify);
    binding.interaction.beginPan(1, { x: 0, y: 0 });
    for (let sample = 1; sample <= 100; sample++)
      binding.interaction.updatePointer(pointer(sample));
    expect(views.get(binding.interaction.getSnapshot().canvasKey)).toBeNull();
    binding.interaction.completePointer(pointer(100));
    for (let sample = 0; sample < 100; sample++)
      binding.interaction.wheelZoom({ x: 10, y: 20 }, sample % 2 ? 1 : -1);
    expect(binding.getSnapshot()).toBe(snapshot);
    expect(notify).not.toHaveBeenCalled();
    expect(serialize).not.toHaveBeenCalled();
    expect(store.getState().documentWorkspace).toBe(workspace);
    expect(client.saveDocument).not.toHaveBeenCalled();
    expect(view.save).not.toHaveBeenCalled();
    expect((await views.flush()).ok).toBe(true);
    expect(view.save).toHaveBeenCalledOnce();
  } finally {
    serialize.mockRestore();
    await setup.dispose();
  }
});
