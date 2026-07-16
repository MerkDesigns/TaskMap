import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

type UseDiscordRpcOptions = {
  appDataLoaded: boolean;
  discordRpcEnabled: boolean;
  canvasName: string | null;
};

export function useDiscordRpc({
  appDataLoaded,
  discordRpcEnabled,
  canvasName,
}: UseDiscordRpcOptions) {
  useEffect(() => {
    if (!appDataLoaded) {
      return;
    }

    const handle = window.setTimeout(() => {
      invoke("set_discord_rpc", {
        enabled: discordRpcEnabled,
        canvasName,
      }).catch((error) => {
        console.error(`Failed to update Discord Rich Presence: ${String(error)}`);
      });
    }, 250);

    return () => {
      window.clearTimeout(handle);
    };
  }, [appDataLoaded, discordRpcEnabled, canvasName]);
}
