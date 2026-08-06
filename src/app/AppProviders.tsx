import type { ReactNode } from "react";
import { Provider } from "react-redux";
import {
  TransientInteractionProvider,
  type TransientInteractionProviderProps,
} from "./interactions/TransientInteractionProvider";
import { appStore, type AppStore } from "./store";

export interface AppProvidersProps {
  readonly children: ReactNode;
  readonly store?: AppStore;
  readonly transientInteractionService?: TransientInteractionProviderProps["service"];
}

export function AppProviders({
  children,
  store = appStore,
  transientInteractionService,
}: AppProvidersProps) {
  return (
    <Provider store={store}>
      <TransientInteractionProvider service={transientInteractionService}>
        {children}
      </TransientInteractionProvider>
    </Provider>
  );
}
