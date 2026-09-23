import { useEffect, useRef, useState } from "react";
import { createWindowCloseController } from "../../app/createWindowCloseController";
import { windowChromeActions } from "../../app/windowChrome";
import { WindowChrome } from "../../components/WindowChrome";
import { tauriWindowCloseClient } from "../../platform/window/tauriWindowCloseClient";
import type { PlatformResult } from "../../platform/platformErrors";

export function DatabaseWindowChrome({
  prepareClose,
}: {
  prepareClose(): Promise<PlatformResult<void>>;
}) {
  const [failed, setFailed] = useState(false);
  const owner = useRef<ReturnType<typeof createWindowCloseController> | null>(null);
  useEffect(() => {
    const controller = createWindowCloseController({
      client: tauriWindowCloseClient,
      prepareClose,
      onError: () => setFailed(true),
    });
    owner.current = controller;
    return () => {
      owner.current = null;
      controller.dispose();
    };
  }, [prepareClose]);
  return (
    <>
      <WindowChrome
        actions={{
          ...windowChromeActions,
          close: async () => {
            setFailed(false);
            await owner.current?.requestClose();
          },
        }}
      />
      {failed && (
        <p
          role="alert"
          className="taskmap-database-entry__error"
          style={{ position: "fixed", bottom: 100, right: 16, zIndex: 100000, maxWidth: 420 }}
        >
          TaskMap could not close safely. A save or another operation may still need attention.
          Please retry closing.
        </p>
      )}
    </>
  );
}
