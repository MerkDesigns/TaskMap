import type { DomainTransaction } from "./transactionTypes";

export type HistoryEntry = DomainTransaction;

export interface HistoryState {
  readonly past: readonly HistoryEntry[];
  readonly future: readonly HistoryEntry[];
}
