import { useContext, useSyncExternalStore } from "react";
import { TransientInteractionContext } from "./TransientInteractionProvider";
import type {
  TransientInteractionService,
  TransientInteractionSnapshot,
} from "./transientInteractionService";

export function useTransientInteractionService(): TransientInteractionService {
  const service = useContext(TransientInteractionContext);
  if (!service) {
    throw new Error("useTransientInteractionService requires TransientInteractionProvider");
  }
  return service;
}

export function useTransientInteraction(): TransientInteractionSnapshot {
  const service = useTransientInteractionService();
  return useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
}
