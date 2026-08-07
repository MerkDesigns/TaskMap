export interface PersistenceScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export const DEFAULT_DOCUMENT_AUTOSAVE_DELAY_MS = 350;

export const defaultPersistenceScheduler: PersistenceScheduler = {
  schedule(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  cancel(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
};
