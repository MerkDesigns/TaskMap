import type { MediaId } from "../../domain/ids/entityIds";
import type { PlatformResult } from "../platformErrors";
import type { MediaAsset, StoredMedia, StoreMediaRequest } from "./mediaTypes";

export interface MediaClient {
  load(id: MediaId): Promise<PlatformResult<MediaAsset>>;
  store(request: StoreMediaRequest): Promise<PlatformResult<StoredMedia>>;
  remove(id: MediaId): Promise<PlatformResult<void>>;
}
