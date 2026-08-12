import { useEffect } from "react";
import { useAppStore } from "../../app/hooks";
import { createTaskMapDocument } from "../../domain/document/createDocument";
import { createEntityId } from "../../domain/ids/entityIds";

export function useDevelopmentWorkspaceBootstrap() {
  const store = useAppStore();

  useEffect(() => {
    if (!import.meta.env.DEV || store.getState().documentWorkspace.document) return;
    const idSource = { nextUuid: () => crypto.randomUUID() };
    const document = createTaskMapDocument({
      databaseId: createEntityId("database", idSource),
      databasePurpose: "development",
      idSource,
    });
    store.workspace.load(document, 0, { autosavePermitted: false });
  }, [store]);
}
