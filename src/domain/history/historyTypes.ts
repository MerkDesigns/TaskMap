import type { DomainTransaction } from "./transactionTypes";

export type HistoryEntry = DomainTransaction;

export interface HistoryState {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}

export interface HistoryCapacity {
  readonly maximumEntries?: number;
}

export interface HistoryIssue {
  readonly code:
    "history-patch-failed" | "history-document-invalid" | "history-transaction-incompatible";
  readonly operation: "undo" | "redo";
  readonly message: string;
}
