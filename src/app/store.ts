import { configureStore, createSlice } from "@reduxjs/toolkit";
import type { TransactionDependencies } from "../domain/commands/executeDocumentCommand";
import { createEntityId } from "../domain/ids/entityIds";
import {
  createDocumentPersistenceCoordinator,
  type DocumentPersistenceDependencies,
} from "./persistence/documentPersistenceCoordinator";
import { createWorkspaceOperations } from "./workspace/workspaceOperations";
import { documentWorkspaceSlice } from "./workspace/workspaceSlice";
import type { HistoryCapacity } from "../domain/history/historyTypes";

export interface ApplicationState {
  readonly activeBoundary: "renderer-v2";
}

const initialApplicationState: ApplicationState = {
  activeBoundary: "renderer-v2",
};

const applicationSlice = createSlice({
  name: "application",
  initialState: initialApplicationState,
  reducers: {},
});

export interface CreateAppStoreOptions {
  readonly transactionDependencies?: TransactionDependencies;
  readonly persistence?: DocumentPersistenceDependencies;
  readonly historyCapacity?: HistoryCapacity;
}

const defaultTransactionDependencies: TransactionDependencies = {
  nextTransactionId: () =>
    createEntityId("transaction", { nextUuid: () => globalThis.crypto.randomUUID() }),
  now: () => Date.now(),
};

export function createAppStore(options: CreateAppStoreOptions = {}) {
  const store = configureStore({
    reducer: {
      application: applicationSlice.reducer,
      documentWorkspace: documentWorkspaceSlice.reducer,
    },
  });
  const persistence = options.persistence
    ? createDocumentPersistenceCoordinator(store, options.persistence)
    : null;
  const workspace = createWorkspaceOperations(
    store,
    options.transactionDependencies ?? defaultTransactionDependencies,
    persistence,
    options.historyCapacity,
  );
  return Object.assign(store, {
    workspace,
    disposeWorkspace() {
      persistence?.dispose();
    },
  });
}

export const appStore = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
