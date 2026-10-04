import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapturedCompletion } from "../../app/commands/retainedCompletionOwner";
import { ReducedMotionProvider } from "../../ui/motion/reducedMotionPreference";
import { COPY_PASTE_JSON_INSTRUCTION } from "./copyPasteJsonFormat";
import { useCopyPasteJsonFlow, type CopyPasteJsonPort } from "./useCopyPasteJsonFlow";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const validJson = JSON.stringify({
  instruction: COPY_PASTE_JSON_INSTRUCTION,
  name: "Ideas",
  color: "#123456",
  cards: [{ text: "One", color: "#ABCDEF", hyperlink: null }],
});

function capture(ok = true) {
  return {
    complete: vi.fn(() => (ok ? { ok: true as const } : { ok: false as const })),
    cancel: vi.fn(),
  } as unknown as CapturedCompletion<string> & {
    complete: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
}

function setup(overrides: Partial<CopyPasteJsonPort> = {}) {
  const port = {
    getJson: vi.fn(() => '{"name":"Ideas"}'),
    captureReplace: vi.fn(() => capture()),
    containerName: vi.fn(() => "Ideas"),
    onReplaced: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  } satisfies CopyPasteJsonPort;
  const flow: { current: ReturnType<typeof useCopyPasteJsonFlow> | null } = { current: null };
  function Host() {
    flow.current = useCopyPasteJsonFlow(port);
    return <>{flow.current.editorWindow}</>;
  }
  const view = render(
    <ReducedMotionProvider override>
      <Host />
    </ReducedMotionProvider>,
  );
  return { port, flow: () => flow.current!, view };
}

function stubClipboard(clipboard: Partial<Clipboard>) {
  vi.stubGlobal("navigator", { ...navigator, clipboard });
}

describe("useCopyPasteJsonFlow", () => {
  it("copies the container's JSON to the clipboard", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ writeText });
    const { port, flow } = setup();

    await act(() => flow().copyJsonForAi("container"));

    expect(writeText).toHaveBeenCalledWith('{"name":"Ideas"}');
    expect(port.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Container JSON copied" }),
    );
  });

  it("captures before reading the clipboard and replaces the cards from valid JSON", async () => {
    const captured = capture();
    const order: string[] = [];
    stubClipboard({
      readText: vi.fn(async () => {
        order.push("read");
        return validJson;
      }),
    });
    const { port, flow } = setup({
      captureReplace: vi.fn(() => {
        order.push("capture");
        return captured;
      }),
    });

    await act(() => flow().pasteJsonFromAi("container"));

    expect(order).toEqual(["capture", "read"]);
    expect(captured.complete).toHaveBeenCalledWith(validJson);
    expect(port.onReplaced).toHaveBeenCalledWith("container");
  });

  it("rejects invalid JSON without completing the capture", async () => {
    const captured = capture();
    stubClipboard({ readText: vi.fn(async () => "not json") });
    const { port, flow } = setup({ captureReplace: vi.fn(() => captured) });

    await act(() => flow().pasteJsonFromAi("container"));

    expect(captured.complete).not.toHaveBeenCalled();
    expect(captured.cancel).toHaveBeenCalled();
    expect(port.onReplaced).not.toHaveBeenCalled();
    expect(port.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Invalid AI JSON" }),
    );
  });

  it("reports a replacement the document refused", async () => {
    stubClipboard({ readText: vi.fn(async () => validJson) });
    const { port, flow } = setup({ captureReplace: vi.fn(() => capture(false)) });

    await act(() => flow().pasteJsonFromAi("container"));

    expect(port.onReplaced).not.toHaveBeenCalled();
    expect(port.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "JSON was not applied" }),
    );
  });

  it("opens the editor on the captured container and closes it after applying", async () => {
    const user = userEvent.setup();
    const captured = capture();
    const { port, flow } = setup({ captureReplace: vi.fn(() => captured) });

    act(() => flow().openJsonEditor("container"));
    expect(screen.getByRole("dialog", { name: "Edit JSON for Ideas" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Container JSON" }), {
      target: { value: validJson },
    });
    await user.click(screen.getByRole("button", { name: "Apply JSON" }));

    expect(captured.complete).toHaveBeenCalledWith(validJson);
    expect(port.onReplaced).toHaveBeenCalledWith("container");
    expect(screen.queryByRole("dialog", { name: "Edit JSON for Ideas" })).not.toBeInTheDocument();
  });

  it("cancels the editor's capture when its container loses the extension", () => {
    const captured = capture();
    const { flow } = setup({ captureReplace: vi.fn(() => captured) });

    act(() => flow().openJsonEditor("container"));
    act(() => flow().closeEditorFor(new Set(["other"])));
    expect(captured.cancel).not.toHaveBeenCalled();
    act(() => flow().closeEditorFor(new Set(["container"])));

    expect(captured.cancel).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open the editor when the container cannot be replaced", () => {
    const { flow } = setup({ captureReplace: vi.fn(() => null) });

    act(() => flow().openJsonEditor("container"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
