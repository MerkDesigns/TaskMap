import type { Patch } from "immer";
import type { TransactionId } from "../ids/entityIds";

export interface DomainTransaction {
  readonly id: TransactionId;
  readonly label: string;
  readonly committedAt: number;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}
