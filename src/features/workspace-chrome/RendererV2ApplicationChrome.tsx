import { Button } from "@mantine/core";
import { IconPuzzle, IconStack2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { TaskMapDocument } from "../../domain/document/documentTypes";
import type { ExtensionId } from "../../extensions/registry";
import { CanvasBrowser } from "../canvases/CanvasBrowser";
import { ExtensionBrowser } from "../extensions/ExtensionBrowser";
import {
  EXTENSION_FAVORITES_STORAGE_KEY,
  loadExtensionFavorites,
  toggleExtensionFavorite,
  type ExtensionFavorites,
  type ExtensionTargetFilter,
} from "../extensions/extensionBrowserModel";
import { LiquidMaterialSurface } from "../../ui/materials/liquid-dom";

export type RendererV2BrowserMode = "canvases" | "extensions";

export interface RendererV2ApplicationChromeProps {
  readonly document: TaskMapDocument | null;
}

export function RendererV2ApplicationChrome({ document }: RendererV2ApplicationChromeProps) {
  const [mode, setMode] = useState<RendererV2BrowserMode>("canvases");
  const [minimalCanvases, setMinimalCanvases] = useState(false);
  const [extensionQuery, setExtensionQuery] = useState("");
  const [extensionTarget, setExtensionTarget] = useState<ExtensionTargetFilter>("all");
  const [favorites, setFavorites] = useState<ExtensionFavorites>(loadExtensionFavorites);

  useEffect(() => {
    try {
      localStorage.setItem(EXTENSION_FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Favorites remain usable for this session when storage is unavailable.
    }
  }, [favorites]);

  const toggleFavorite = (extensionId: ExtensionId) => {
    setFavorites((current) => toggleExtensionFavorite(current, extensionId));
  };

  return (
    <div className="taskmap-renderer-v2-chrome" aria-label="TaskMap application chrome">
      <LiquidMaterialSurface
        role="small-panel"
        sceneOrder={40}
        className="taskmap-renderer-v2-topbar-anchor"
      >
        <nav className="taskmap-renderer-v2-topbar" aria-label="Browser mode">
          <Button
            size="compact-sm"
            variant={mode === "canvases" ? "light" : "subtle"}
            color={mode === "canvases" ? "cyan" : "gray"}
            leftSection={<IconStack2 size={15} />}
            aria-pressed={mode === "canvases"}
            onClick={() => setMode("canvases")}
          >
            Canvases
          </Button>
          <Button
            size="compact-sm"
            variant={mode === "extensions" ? "light" : "subtle"}
            color={mode === "extensions" ? "cyan" : "gray"}
            leftSection={<IconPuzzle size={15} />}
            aria-pressed={mode === "extensions"}
            onClick={() => setMode("extensions")}
          >
            Extensions
          </Button>
          <span className="taskmap-renderer-v2-topbar__future" aria-hidden="true" />
        </nav>
      </LiquidMaterialSurface>

      <LiquidMaterialSurface
        role="large-panel"
        sceneOrder={10}
        className="taskmap-renderer-v2-browser-anchor"
      >
        <div className="taskmap-renderer-v2-browser-panel">
          <div key={mode} className="taskmap-renderer-v2-browser-content">
            {mode === "canvases" ? (
              <CanvasBrowser
                document={document}
                minimal={minimalCanvases}
                onMinimalChange={setMinimalCanvases}
              />
            ) : (
              <ExtensionBrowser
                query={extensionQuery}
                target={extensionTarget}
                favorites={favorites}
                onQueryChange={setExtensionQuery}
                onTargetChange={setExtensionTarget}
                onToggleFavorite={toggleFavorite}
              />
            )}
          </div>
        </div>
      </LiquidMaterialSurface>
    </div>
  );
}
