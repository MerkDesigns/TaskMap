export type RendererV2PanelRole = "large-panel" | "small-panel";

export type RendererV2PanelGeometry = Record<
  RendererV2PanelRole,
  Readonly<{ cornerRadius: number }>
>;

export const RENDERER_V2_PANEL_ROLES = ["large-panel", "small-panel"] as const;

export const DEFAULT_RENDERER_V2_PANEL_GEOMETRY: Readonly<RendererV2PanelGeometry> = Object.freeze({
  "large-panel": Object.freeze({ cornerRadius: 23 }),
  "small-panel": Object.freeze({ cornerRadius: 13 }),
});

export function createRendererV2PanelGeometry(): RendererV2PanelGeometry {
  return {
    "large-panel": { ...DEFAULT_RENDERER_V2_PANEL_GEOMETRY["large-panel"] },
    "small-panel": { ...DEFAULT_RENDERER_V2_PANEL_GEOMETRY["small-panel"] },
  };
}
