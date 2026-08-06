export type PlatformErrorCode =
  | "cancelled"
  | "not-found"
  | "permission-denied"
  | "conflict"
  | "invalid-request"
  | "unavailable"
  | "unexpected";

export interface PlatformError {
  readonly code: PlatformErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type PlatformResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: PlatformError };
