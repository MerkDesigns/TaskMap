import type { DocumentInvariantIssue } from "../document/documentInvariants";
import type { DomainTransaction } from "../history/transactionTypes";

export type CommandIssue =
  | DocumentInvariantIssue
  | {
      readonly code: "unknown-command";
      readonly path: "command.type";
      readonly message: string;
    };

export type CommandResult<Document> =
  | {
      readonly ok: true;
      readonly document: Document;
      readonly transaction: DomainTransaction | null;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CommandIssue[];
    };
