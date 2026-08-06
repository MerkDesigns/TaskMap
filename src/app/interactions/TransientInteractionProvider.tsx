import { createContext, useState, type ReactNode } from "react";
import {
  createDefaultTransientInteractionService,
  type TransientInteractionService,
} from "./transientInteractionService";

export const TransientInteractionContext = createContext<TransientInteractionService | null>(null);

export interface TransientInteractionProviderProps {
  readonly children: ReactNode;
  readonly service?: TransientInteractionService;
}

export function TransientInteractionProvider({
  children,
  service,
}: TransientInteractionProviderProps) {
  const [defaultService] = useState(createDefaultTransientInteractionService);

  return (
    <TransientInteractionContext.Provider value={service ?? defaultService}>
      {children}
    </TransientInteractionContext.Provider>
  );
}
