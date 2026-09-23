import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import { sessionSetup, success } from "../../app/database/databaseSessionTestSupport";
import type { PlatformResult } from "../../platform/platformErrors";
import type { DatabaseEntryRuntime } from "./databaseEntryTypes";
import { DatabaseSessionGate } from "./DatabaseSessionGate";

export function entrySetup() {
  const session = sessionSetup();
  const settingsClient = {
    chooseDatabasePath: vi.fn<DatabaseEntryRuntime["settingsClient"]["chooseDatabasePath"]>(
      async () => success({ authorizationToken: "chosen-token", displayPath: "Test.tmapdb" }),
    ),
    listRecentDatabases: vi.fn<DatabaseEntryRuntime["settingsClient"]["listRecentDatabases"]>(
      async () =>
        success({
          version: 1,
          edition: "development",
          recentDatabases: [{ authorizationToken: "recent-token", displayPath: "Recent.tmapdb" }],
        }),
    ),
  };
  const initializeResources = vi.fn<DatabaseEntryRuntime["initializeResources"]>(async () =>
    success(undefined),
  );
  const runtime: DatabaseEntryRuntime = {
    controller: session.controller,
    edition: "development",
    settingsClient,
    initializeResources,
  };
  return { ...session, settingsClient, initializeResources, runtime };
}

export async function mountEntry(setup: ReturnType<typeof entrySetup>) {
  const view = render(
    <StrictMode>
      <DatabaseSessionGate runtime={setup.runtime}>
        <div data-testid="workspace">Retained view</div>
      </DatabaseSessionGate>
    </StrictMode>,
  );
  await waitFor(() => expect(expectButton("New database")).toBeEnabled());
  return view;
}

export const expectButton = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
export const passwordInput = () => screen.getByLabelText("Password *") as HTMLInputElement;
export function submitPassword(value = "test-only", confirmation?: string) {
  fireEvent.change(passwordInput(), { target: { value } });
  if (confirmation !== undefined)
    fireEvent.change(screen.getByLabelText("Confirm password *"), {
      target: { value: confirmation },
    });
  fireEvent.submit(passwordInput().closest("form")!);
}
export async function openEntry() {
  fireEvent.click(expectButton("Open database"));
  await screen.findByLabelText("Password *");
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
export const failure = (
  code: "wrong_password" | "unexpected" | "file_not_found" = "unexpected",
): PlatformResult<never> => ({
  ok: false,
  error: { code, message: "PRIVATE_BACKEND_DETAIL", retryable: true },
});
