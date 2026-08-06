import type { RootState } from "../store";

export const selectActiveApplicationBoundary = (state: RootState) =>
  state.application.activeBoundary;
