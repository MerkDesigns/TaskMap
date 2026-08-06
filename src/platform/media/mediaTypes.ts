import type { MediaId } from "../../domain/ids/entityIds";

export interface MediaAsset {
  readonly id: MediaId;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface StoreMediaRequest {
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface StoredMedia {
  readonly id: MediaId;
}
