// DEV/PROTOTYPE ONLY — do not port with Renderer V2 production implementation.
import { Button, Divider, Popover, Select, Stack, Textarea } from "@mantine/core";
import { IconAdjustments } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  BENCHMARK_CANVAS_BROWSER,
  DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION,
  type BenchmarkCanvasCardPresentation,
} from "../benchmarkCanvasBrowserLayout";
import {
  DEFAULT_RENDERER_V2_ACCENT,
  DEFAULT_RENDERER_V2_MATERIAL_CONTROLS,
  type RendererV2MaterialControls,
  type RendererV2PanelControls,
} from "../rendererV2PanelMaterials";
import {
  DEFAULT_RENDERER_V2_PANEL_GEOMETRY,
  RENDERER_V2_PANEL_ROLES,
  type RendererV2PanelGeometry,
  type RendererV2PanelRole,
} from "../rendererV2PanelGeometry";
import { ResettableColor, ResettableSlider, ResettableText } from "./BenchmarkMaterialControls";

interface Props {
  readonly materials: RendererV2MaterialControls;
  readonly panelGeometry: RendererV2PanelGeometry;
  readonly cardGap: number;
  readonly accent: string;
  readonly cardPresentation: BenchmarkCanvasCardPresentation;
  readonly onMaterialsChange: (materials: RendererV2MaterialControls) => void;
  readonly onPanelGeometryChange: (geometry: RendererV2PanelGeometry) => void;
  readonly onCardGapChange: (gap: number) => void;
  readonly onAccentChange: (accent: string) => void;
  readonly onCardPresentationChange: (presentation: BenchmarkCanvasCardPresentation) => void;
}

export function BenchmarkMaterialMenu({
  materials,
  panelGeometry,
  cardGap,
  accent,
  cardPresentation,
  onMaterialsChange,
  onPanelGeometryChange,
  onCardGapChange,
  onAccentChange,
  onCardPresentationChange,
}: Props) {
  const [role, setRole] = useState<RendererV2PanelRole>("large-panel");
  const selected = materials[role];
  const defaults = DEFAULT_RENDERER_V2_MATERIAL_CONTROLS[role];
  const selectedGeometry = panelGeometry[role];
  const geometryDefaults = DEFAULT_RENDERER_V2_PANEL_GEOMETRY[role];
  const update = <Key extends keyof RendererV2PanelControls>(
    key: Key,
    value: RendererV2PanelControls[Key],
  ) => onMaterialsChange({ ...materials, [role]: { ...selected, [key]: value } });

  return (
    <Popover width={300} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <Button size="compact-xs" variant="default" leftSection={<IconAdjustments size={14} />}>
          Materials
        </Button>
      </Popover.Target>
      <Popover.Dropdown className="renderer-benchmark__material-menu">
        <Stack gap="xs">
          <Select
            label="Material"
            size="xs"
            value={role}
            data={RENDERER_V2_PANEL_ROLES.map((value) => ({
              value,
              label: value === "large-panel" ? "Large Panel" : "Small Panel",
            }))}
            comboboxProps={{ withinPortal: false }}
            onChange={(value) => value && setRole(value as RendererV2PanelRole)}
          />
          <ResettableColor
            label="Tint"
            value={selected.tint}
            resetValue={defaults.tint}
            onChange={(value) => update("tint", value)}
          />
          <ResettableSlider
            label="Tint opacity"
            value={selected.tintOpacity}
            resetValue={defaults.tintOpacity}
            minimum={0}
            maximum={1}
            step={0.01}
            onChange={(value) => update("tintOpacity", value)}
          />
          <ResettableSlider
            label="Corner radius"
            value={selectedGeometry.cornerRadius}
            resetValue={geometryDefaults.cornerRadius}
            minimum={0}
            maximum={36}
            step={1}
            onChange={(cornerRadius) =>
              onPanelGeometryChange({
                ...panelGeometry,
                [role]: { cornerRadius },
              })
            }
          />
          <ResettableSlider
            label="Blur"
            value={selected.blur}
            resetValue={defaults.blur}
            minimum={0}
            maximum={100}
            step={1}
            onChange={(value) => update("blur", value)}
          />
          <ResettableSlider
            label="Border opacity"
            value={selected.borderOpacity}
            resetValue={defaults.borderOpacity}
            minimum={0}
            maximum={1}
            step={0.01}
            onChange={(value) => update("borderOpacity", value)}
          />
          <MaterialJsonEditor
            key={role}
            value={selected}
            onChange={(value) => onMaterialsChange({ ...materials, [role]: value })}
          />
          <Divider />
          <ResettableSlider
            label="Canvas card gap"
            value={cardGap}
            resetValue={BENCHMARK_CANVAS_BROWSER.cardGap}
            minimum={0}
            maximum={24}
            step={1}
            onChange={onCardGapChange}
          />
          <ResettableColor
            label="Accent"
            value={accent}
            resetValue={DEFAULT_RENDERER_V2_ACCENT}
            onChange={onAccentChange}
          />
          <ResettableSlider
            label="Preview edge gap"
            value={cardPresentation.previewInset}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.previewInset}
            minimum={0}
            maximum={24}
            step={1}
            onChange={(previewInset) =>
              onCardPresentationChange({ ...cardPresentation, previewInset })
            }
          />
          <ResettableSlider
            label="Preview ratio (%)"
            value={cardPresentation.previewRatioPercent}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.previewRatioPercent}
            minimum={0}
            maximum={100}
            step={1}
            onChange={(previewRatioPercent) =>
              onCardPresentationChange({ ...cardPresentation, previewRatioPercent })
            }
          />
          <ResettableSlider
            label="Preview corner radius"
            value={cardPresentation.previewCornerRadius}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.previewCornerRadius}
            minimum={0}
            maximum={24}
            step={1}
            onChange={(previewCornerRadius) =>
              onCardPresentationChange({ ...cardPresentation, previewCornerRadius })
            }
          />
          <ResettableSlider
            label="Large text size"
            value={cardPresentation.largeTextSize}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.largeTextSize}
            minimum={8}
            maximum={20}
            step={1}
            onChange={(largeTextSize) =>
              onCardPresentationChange({ ...cardPresentation, largeTextSize })
            }
          />
          <ResettableSlider
            label="Small text size"
            value={cardPresentation.smallTextSize}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.smallTextSize}
            minimum={8}
            maximum={16}
            step={1}
            onChange={(smallTextSize) =>
              onCardPresentationChange({ ...cardPresentation, smallTextSize })
            }
          />
          <ResettableText
            label="Large text"
            value={cardPresentation.largeText}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.largeText}
            onChange={(largeText) => onCardPresentationChange({ ...cardPresentation, largeText })}
          />
          <ResettableText
            label="Small text"
            value={cardPresentation.smallText}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.smallText}
            onChange={(smallText) => onCardPresentationChange({ ...cardPresentation, smallText })}
          />
          <ResettableSlider
            label="Three-dot right gap"
            value={cardPresentation.optionsRightGap}
            resetValue={DEFAULT_BENCHMARK_CANVAS_CARD_PRESENTATION.optionsRightGap}
            minimum={0}
            maximum={24}
            step={1}
            onChange={(optionsRightGap) =>
              onCardPresentationChange({ ...cardPresentation, optionsRightGap })
            }
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function MaterialJsonEditor({
  value,
  onChange,
}: {
  readonly value: RendererV2PanelControls;
  readonly onChange: (value: RendererV2PanelControls) => void;
}) {
  const [draft, setDraft] = useState(() => JSON.stringify(value, null, 2));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editing) setDraft(JSON.stringify(value, null, 2));
  }, [editing, value]);

  useEffect(() => {
    if (!editing) return;
    const timeout = window.setTimeout(() => {
      const parsed = parseMaterialJson(draft);
      if (!parsed) {
        setError("Enter a complete material JSON object");
        return;
      }
      setError(null);
      setEditing(false);
      onChangeRef.current(parsed);
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [draft, editing]);

  return (
    <Textarea
      label="Material JSON"
      value={draft}
      error={error}
      autosize
      minRows={7}
      maxRows={12}
      spellCheck={false}
      styles={{ input: { fontFamily: "Consolas, monospace", fontSize: 11 } }}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        setEditing(true);
      }}
    />
  );
}

function parseMaterialJson(source: string): RendererV2PanelControls | null {
  try {
    const value: unknown = JSON.parse(source);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const material = value as Record<string, unknown>;
    if (typeof material.tint !== "string") return null;
    const numericKeys = ["tintOpacity", "blur", "borderOpacity"] as const;
    if (numericKeys.some((key) => !isFiniteNumber(material[key]))) return null;
    return {
      tint: material.tint,
      tintOpacity: material.tintOpacity as number,
      blur: material.blur as number,
      borderOpacity: material.borderOpacity as number,
    };
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
