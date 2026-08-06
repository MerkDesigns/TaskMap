import { configureStore, createSlice } from "@reduxjs/toolkit";

export interface ApplicationState {
  readonly activeBoundary: "legacy";
}

const initialApplicationState: ApplicationState = {
  activeBoundary: "legacy",
};

const applicationSlice = createSlice({
  name: "application",
  initialState: initialApplicationState,
  reducers: {},
});

export function createAppStore() {
  return configureStore({
    reducer: {
      application: applicationSlice.reducer,
    },
  });
}

export const appStore = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
