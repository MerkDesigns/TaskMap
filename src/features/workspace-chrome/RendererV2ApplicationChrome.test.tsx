import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import { useAppSelector } from "../../app/hooks";
import { createAppStore } from "../../app/store";
import { createTaskMapDocument } from "../../domain/document/createDocument";
import { asEntityId, createEntityId } from "../../domain/ids/entityIds";
import { TaskMapMantineProvider } from "../../ui/mantine/TaskMapMantineProvider";
import { RendererV2ApplicationChrome } from "./RendererV2ApplicationChrome";

function createStoreWithTwoCanvases() {
  let sequence = 1;
  const nextUuid = () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, "0")}`;
  const document = createTaskMapDocument({
    databaseId: asEntityId("database", "database-00000000-0000-4000-8000-000000000001"),
    databasePurpose: "development",
    idSource: { nextUuid },
    initialCanvasName: "Canvas 1",
  });
  const secondId = createEntityId("canvas", { nextUuid });
  const store = createAppStore();
  store.workspace.load(document, 0);
  store.workspace.dispatchCommand({
    type: "document.canvas.create",
    payload: {
      canvas: {
        id: secondId,
        name: "Canvas 2",
        settings: { width: 4_000, height: 2_000 },
      },
    },
  });
  return { store, secondId };
}

function ConnectedChrome() {
  const document = useAppSelector((state) => state.documentWorkspace.document);
  return <RendererV2ApplicationChrome document={document} />;
}

function renderChrome(store = createStoreWithTwoCanvases().store) {
  return render(
    <TaskMapMantineProvider>
      <AppProviders store={store}>
        <ConnectedChrome />
      </AppProviders>
    </TaskMapMantineProvider>,
  );
}

afterEach(cleanup);

describe("RendererV2ApplicationChrome", () => {
  it("switches the real active canvas", async () => {
    const user = userEvent.setup();
    const { store, secondId } = createStoreWithTwoCanvases();
    renderChrome(store);

    await user.click(screen.getByText("Canvas 2"));
    expect(store.getState().documentWorkspace.document!.activeCanvasId).toBe(secondId);
  });

  it("switches one browser shell between canvases and extensions without losing search state", async () => {
    const user = userEvent.setup();
    renderChrome();
    expect(screen.getByRole("region", { name: "Canvases" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Extensions" }));
    const search = screen.getByRole("textbox", { name: "Search extensions" });
    await user.type(search, "lock");
    await user.click(screen.getByRole("button", { name: "Canvases" }));
    await user.click(screen.getByRole("button", { name: "Extensions" }));

    expect(screen.getByRole("textbox", { name: "Search extensions" })).toHaveValue("lock");
  });
});
