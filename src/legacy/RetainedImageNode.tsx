import { useContext, useEffect, useState, type ComponentProps } from "react";
import { ImageNode } from "../components/ImageNode";
import { RetainedCanvasContext } from "./RetainedCanvasContext";
import type { RetainedImageView } from "../elements/image/imageViewProjection";

/** Mounted inside the existing visibility boundary; only visible images acquire byte/URL leases. */
export function RetainedImageNode(props: ComponentProps<typeof ImageNode>) {
  const context = useContext(RetainedCanvasContext);
  if (!context) throw new Error("Image requires its database session.");
  const resources = context.runtime.media;
  const metadata = (props.image as unknown as RetainedImageView).media;
  const [loaded, setLoaded] = useState<{ metadata: typeof metadata; url: string | null } | null>(
    null,
  );
  useEffect(() => {
    if (!metadata) return;
    let active = true;
    const lease = resources.acquire(metadata);
    void lease.ready.then((url) => {
      if (active) setLoaded({ metadata, url });
    });
    return () => {
      active = false;
      lease.release();
    };
  }, [metadata, resources]);
  const settled = loaded?.metadata === metadata;
  return (
    <ImageNode
      {...props}
      hasMedia={!!metadata}
      url={settled ? loaded!.url : null}
      loading={props.loading || (!!metadata && !settled)}
      unavailable={!!metadata && settled && !loaded?.url}
    />
  );
}
