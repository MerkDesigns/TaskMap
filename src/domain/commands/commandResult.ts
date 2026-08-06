import type { DocumentInvariantIssue } from "../document/documentInvariants";
import type { DocumentStructureIssue } from "../document/documentSchema";
import type { DomainTransaction } from "../history/transactionTypes";

export type CommandIssue =
  | DocumentInvariantIssue
  | DocumentStructureIssue
  | {
      readonly code: "unknown-command";
      readonly path: "command.type";
      readonly message: string;
    }
  | {
      readonly code:
        "invalid-command" | "command-payload" | "command-rejected" | "command-handler-failed";
      readonly path: string;
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
      readonly document: Document;
      readonly transaction: null;
      readonly issues: readonly CommandIssue[];
    };
