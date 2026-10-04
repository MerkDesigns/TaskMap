import { vi } from "vitest";
import type { ExtensionCommands } from "./extensionCommands";

/** An `ExtensionCommands` port whose every command is a spy. */
export function mockExtensionCommands() {
  return {
    toggle: vi.fn(),
    remove: vi.fn(),
    updateAccent: vi.fn(),
    updateSelectionAccent: vi.fn(),
    rememberRecentColor: vi.fn(),
    setSearchQuery: vi.fn(),
    copyJsonForAi: vi.fn(async () => undefined),
    pasteJsonFromAi: vi.fn(async () => undefined),
    openJsonEditor: vi.fn(),
    openWorkflowEditor: vi.fn(),
  } satisfies ExtensionCommands;
}
