import type { TransferableCacheBitmap } from "./acrylicCanvas";
import {
  parseAcrylicWorkerBuildRequest,
  readWorkerRequestIdentity,
  type AcrylicWorkerBuildRequest,
  type AcrylicWorkerFailure,
  type AcrylicWorkerSuccess,
} from "./acrylicWorkerProtocol";
import { SharedAcrylicCacheBuildError } from "./sharedAcrylicCacheBuilder";

export interface AcrylicWorkerMessageTarget {
  postMessage(message: object, transfer?: readonly object[]): void;
}

export type AcrylicWorkerCacheBuilder = (
  request: AcrylicWorkerBuildRequest,
) => TransferableCacheBitmap | Promise<TransferableCacheBitmap>;

/** Executes one caller-scheduled request; scheduling remains exclusively in the B1/client runtime. */
export async function processAcrylicWorkerMessage(
  value: unknown,
  target: AcrylicWorkerMessageTarget,
  build: AcrylicWorkerCacheBuilder,
): Promise<void> {
  let request;
  try {
    request = parseAcrylicWorkerBuildRequest(value);
  } catch {
    const requestIdentity = readWorkerRequestIdentity(value);
    if (requestIdentity) {
      postFailure(target, { type: "failure", request: requestIdentity, code: "invalid-request" });
    }
    return;
  }

  let bitmap: TransferableCacheBitmap | null = null;
  try {
    bitmap = await build(request);
    const response: AcrylicWorkerSuccess<TransferableCacheBitmap> = {
      type: "success",
      descriptor: request.descriptor,
      bitmap,
    };
    target.postMessage(response, [bitmap as object]);
    bitmap = null;
  } catch (error) {
    bitmap?.close();
    postFailure(target, {
      type: "failure",
      request: request.descriptor.request,
      code: error instanceof SharedAcrylicCacheBuildError ? error.code : "bitmap-failed",
    });
  }
}

function postFailure(target: AcrylicWorkerMessageTarget, failure: AcrylicWorkerFailure): void {
  try {
    target.postMessage(failure);
  } catch {
    /* No worker resource remains; the client error channel fails the active request closed. */
  }
}
