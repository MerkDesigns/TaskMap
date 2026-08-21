import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MaterialPlaneProvider } from "../ui/materials/MaterialPlane";
import { MotionProvider } from "../ui/motion/MotionProvider";
import {
  createMotionFrameScheduler,
  type MotionFrameDriver,
} from "../ui/motion/motionFrameScheduler";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { ModalPresence } from "../ui/patterns/overlays";
import {
  ClearCanvasModal,
  SettingsPasswordDialog,
  UpdateAvailableModal,
} from "./ProductionDialogs";

afterEach(cleanup);

const update = {
  version: "1.2.3",
  currentVersion: "1.0.0",
};

describe("C3B production dialogs", () => {
  it("preserves Update callbacks, busy dismissal guards, labels, and errors", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const install = deferred<void>();
    const onInstall = vi.fn(() => install.promise);
    renderRoot(
      <UpdateAvailableModal update={update} onInstall={onInstall} onDismiss={onDismiss} />,
    );

    const dialog = screen.getByRole("dialog", { name: "Update available" });
    expect(dialog).toHaveAttribute("data-material", "acrylic-large");
    expect(dialog).toHaveAttribute("data-material-plane", "modal");
    expect(dialog.style.width).toBe("380px");
    expect(screen.getByText("TaskMap 1.2.3 is ready to download.")).toBeInTheDocument();
    expect(screen.getByText("Current version: 1.0.0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Update" }));
    expect(onInstall).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Installing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => install.reject(new Error("Install failed")));
    expect(await screen.findByText("Install failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("supports nested Update placement without another root scrim", () => {
    render(
      <ReducedMotionProvider override>
        <MaterialPlaneProvider plane="modal">
          <ModalPresence open placement="nested">
            <UpdateAvailableModal update={update} onInstall={vi.fn()} onDismiss={vi.fn()} />
          </ModalPresence>
        </MaterialPlaneProvider>
      </ReducedMotionProvider>,
    );
    expect(document.querySelectorAll(".taskmap-modal-scrim")).toHaveLength(0);
    expect(document.querySelectorAll(".taskmap-nested-modal-scrim")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Update available" })).toHaveAttribute(
      "data-material-plane",
      "modal",
    );
  });

  it("preserves Clear Canvas Escape, cancel, danger confirm, and immediate mutation callbacks", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderRoot(<ClearCanvasModal onCancel={onCancel} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("dialog", { name: "Clear canvas?" });
    expect(dialog.style.width).toBe("360px");
    expect(screen.getByRole("button", { name: "Clear" })).toHaveClass("taskmap-button--danger");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps focus trapped until animated exit completes and only then restores it", () => {
    const driver = new ControlledFrameDriver();
    const scheduler = createMotionFrameScheduler(driver);
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const view = (open: boolean) => (
      <ReducedMotionProvider override={false}>
        <MotionProvider scheduler={scheduler}>
          <ModalPresence open={open}>
            <ClearCanvasModal onCancel={vi.fn()} onConfirm={vi.fn()} />
          </ModalPresence>
        </MotionProvider>
      </ReducedMotionProvider>
    );
    const { rerender } = render(view(true));
    act(() => driver.flush());
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    rerender(view(false));
    expect(screen.getByRole("dialog", { name: "Clear canvas?" })).toBeInTheDocument();
    expect(opener).not.toHaveFocus();
    act(() => driver.flush());
    expect(screen.queryByRole("dialog", { name: "Clear canvas?" })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    opener.remove();
    scheduler.dispose();
  });

  it("uses the native password field contract and preserves submit/close behavior", async () => {
    const user = userEvent.setup();
    const onPasswordChange = vi.fn();
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <ReducedMotionProvider override>
        <MaterialPlaneProvider plane="modal">
          <ModalPresence open placement="nested">
            <SettingsPasswordDialog
              busy={false}
              mode="import"
              password=""
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmit}
              onClose={onClose}
            />
          </ModalPresence>
        </MaterialPlaneProvider>
      </ReducedMotionProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Import data" });
    expect(dialog.style.width).toBe("340px");
    const input = screen.getByPlaceholderText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("spellcheck", "false");
    await waitFor(() => expect(input).toHaveFocus());
    await user.type(input, "secret{Enter}");
    expect(onPasswordChange).toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledOnce();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
    expect(dialog).toHaveClass("taskmap-modal-dialog");
  });
});

function renderRoot(children: ReactNode) {
  return render(
    <ReducedMotionProvider override>
      <ModalPresence open>{children}</ModalPresence>
    </ReducedMotionProvider>,
  );
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class ControlledFrameDriver implements MotionFrameDriver {
  private callbacks = new Map<number, (timestampMs: number) => void>();
  private nextHandle = 1;
  private timestampMs = 0;

  request(callback: (timestampMs: number) => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  fire(): boolean {
    const entry = this.callbacks.entries().next().value as
      [number, (timestampMs: number) => void] | undefined;
    if (!entry) return false;
    this.callbacks.delete(entry[0]);
    this.timestampMs += 1000 / 60;
    entry[1](this.timestampMs);
    return true;
  }

  flush(limit = 60): void {
    for (let frame = 0; frame < limit && this.fire(); frame += 1) {
      // Shared scheduler drains the retained modal presence.
    }
  }
}
