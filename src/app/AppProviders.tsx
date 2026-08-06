import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { appStore, type AppStore } from "./store";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly store?: AppStore;
}

export function AppProviders({ children, store = appStore }: AppProvidersProps) {
  return <Provider store={store}>{children}</Provider>;
}
