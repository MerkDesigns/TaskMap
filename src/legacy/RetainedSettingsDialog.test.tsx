import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { useAppUpdates } from "../hooks/useAppUpdates";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { RetainedSettingsDialog, type RetainedSettingsDialogProps } from "./RetainedSettingsDialog";
import { useLegacyCanvasSettings } from "./useLegacyCanvasSettings";

const update = { version: "9.9.9", currentVersion: "1.0.0" };

function renderDialog(
  overrides: Partial<Omit<RetainedSettingsDialogProps, "settings">> & {
    settings?: Partial<RetainedSettingsDialogProps["settings"]>;
  } = {},
) {
  const { result } = renderHook(() => useLegacyCanvasSettings());
  const updates: ReturnType<typeof useAppUpdates> = {
    appVersion: "1.0.0",
    availableUpdate: update,
    updateModalOpen: true,
    checkForAppUpdate: vi.fn(async () => null),
    installAppUpdate: vi.fn(async () => {}),
    dismissUpdateModal: vi.fn(),
  };
  const session = {
    lock: vi.fn(async () => ({ ok: true })),
    close: vi.fn(async () => ({ ok: true })),
    quit: vi.fn(async () => ({ ok: true })),
  };
  const props: RetainedSettingsDialogProps = {
    open: false,
    onClose: vi.fn(),
    updates,
    session,
    onRememberRecentColor: vi.fn(),
    fpsCounterVisible: false,
    onFpsCounterVisibleChange: vi.fn(),
    ...overrides,
    settings: { ...result.current, ...overrides.settings },
  };
  const view = render(
    <ReducedMotionProvider override>
      <RetainedSettingsDialog {...props} />
    </ReducedMotionProvider>,
  );
  return { ...view, props };
}

describe("RetainedSettingsDialog", () => {
  it("holds the update prompt back while Settings is open", async () => {
    const { rerender, props } = renderDialog({ open: true });

    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Update available" })).toBeNull();

    rerender(
      <ReducedMotionProvider override>
        <RetainedSettingsDialog {...props} open={false} />
      </ReducedMotionProvider>,
    );
    expect(await screen.findByRole("dialog", { name: "Update available" })).toBeInTheDocument();
  });

  it("abandons an unfinished grid opacity drag when Settings closes", async () => {
    const gridOpacityEdit = { begin: vi.fn(), commit: vi.fn(), cancel: vi.fn() };
    const { props } = renderDialog({
      open: true,
      settings: { gridOpacityEdit },
    });

    await userEvent.setup().click(await screen.findByRole("button", { name: "Close settings" }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(gridOpacityEdit.cancel).toHaveBeenCalledOnce();
  });

  it("reports a settings save that failed", () => {
    renderDialog({ settings: { settingsError: "Settings could not be saved." } });

    expect(screen.getByRole("alert")).toHaveTextContent("Settings could not be saved.");
  });
});
