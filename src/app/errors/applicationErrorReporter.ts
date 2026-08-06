export interface ApplicationErrorReport {
  readonly source: "new-architecture";
  readonly error: unknown;
  readonly componentStack: string | null;
}

export interface ApplicationErrorReporter {
  readonly report: (failure: ApplicationErrorReport) => void;
}

function errorType(error: unknown): string {
  if (error instanceof Error) return "Error";
  if (error === null) return "null";
  return typeof error;
}

export const defaultApplicationErrorReporter: ApplicationErrorReporter = {
  report: (failure) => {
    // Deliberately omit the error message, stack, and component data: they may
    // contain decrypted document content. Detailed reporting can be injected.
    console.error("TaskMap new-architecture render failure", {
      source: failure.source,
      errorType: errorType(failure.error),
    });
  },
};
