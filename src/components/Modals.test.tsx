import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ELEMENT_COLORS } from "../constants";
import { ClearCanvasModal, SettingsModal } from "./Modals";

describe("modal keyboard behavior", () => {
  it("traps focus, closes with Escape, and restores prior focus", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(<ClearCanvasModal onCancel={onCancel} onConfirm={vi.fn()} />);
    const cancel = await screen.findByRole("button", { name: "Cancel" });
    const clear = screen.getByRole("button", { name: "Clear" });
    await waitFor(() => expect(cancel).toHaveFocus());

    await user.tab({ shift: true });
    expect(clear).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("opens the extension color picker for default element colors", async () => {
    const user = userEvent.setup();
    const onDefaultElementColorChange = vi.fn();
    const onRememberRecentColor = vi.fn();
    const onAllowLockedElementDeletionChange = vi.fn();

    render(
      <SettingsModal
        canvasGridStyle="dots"
        onCanvasGridStyleChange={vi.fn()}
        canvasGridOpacity={50}
        onCanvasGridOpacityChange={vi.fn()}
        defaultElementColors={DEFAULT_ELEMENT_COLORS}
        onDefaultElementColorChange={onDefaultElementColorChange}
        recentColors={["#ABCDEF"]}
        onRememberRecentColor={onRememberRecentColor}
        shadowsUnderElements
        onShadowsUnderElementsChange={vi.fn()}
        allowLockedElementDeletion
        onAllowLockedElementDeletionChange={onAllowLockedElementDeletionChange}
        onExportData={vi.fn(async () => true)}
        onImportData={vi.fn(async () => undefined)}
        discordRpcEnabled={false}
        onDiscordRpcEnabledChange={vi.fn()}
        discordRpcShowCanvas={true}
        onDiscordRpcShowCanvasChange={vi.fn()}
        availableUpdate={null}
        appVersion="0.2.8"
        fpsCounterVisible={false}
        onFpsCounterVisibleChange={vi.fn()}
        privacyModeEnabled={false}
        onPrivacyModeEnabledChange={vi.fn()}
        temporaryPanelsVisible={false}
        onTemporaryPanelsVisibleChange={vi.fn()}
        onCheckForUpdate={vi.fn(async () => null)}
        onInstallUpdate={vi.fn(async () => undefined)}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTitle("Choose default containers color"));
    const colorInput = screen.getByTitle("Visual color picker");
    expect(colorInput).toBeInTheDocument();
    expect(screen.getByText("Extra colors")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();

    fireEvent.change(colorInput, { target: { value: "#123456" } });
    expect(onDefaultElementColorChange).toHaveBeenCalledWith("container", "#123456");
    expect(onRememberRecentColor).not.toHaveBeenCalled();

    fireEvent.change(colorInput, { target: { value: "#234567" } });
    expect(onRememberRecentColor).not.toHaveBeenCalled();

    await user.click(screen.getByTitle("Close"));
    expect(onRememberRecentColor).toHaveBeenCalledTimes(1);
    expect(onRememberRecentColor).toHaveBeenCalledWith("#234567");

    await user.click(screen.getByRole("button", { name: "misc" }));
    const lockedDeletionToggle = screen.getByRole("checkbox", {
      name: /Allow removing locked elements/i,
    });
    expect(lockedDeletionToggle).toBeChecked();
    await user.click(lockedDeletionToggle);
    expect(onAllowLockedElementDeletionChange).toHaveBeenCalledWith(false);
  });
});
