// DEV/PROTOTYPE ONLY — do not port with Renderer V2 production implementation.
import {
  Button,
  Checkbox,
  Group,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import {
  CANVAS_BROWSER_DIAGNOSTIC_LABELS,
  CANVAS_BROWSER_DIAGNOSTIC_MODES,
  type CanvasBrowserDiagnosticMode,
} from "./canvasBrowserDiagnostics";
import type { BenchmarkSceneStore } from "../benchmarkSceneStore";
import {
  BENCHMARK_CANVAS_CARD_COUNT,
  BENCHMARK_CANVAS_ELEMENT_COUNT,
} from "../benchmarkSceneStore";
import type { BenchmarkViewportController } from "../benchmarkViewportController";
import { BenchmarkMaterialMenu } from "./BenchmarkMaterialMenu";
import type { BenchmarkCanvasCardPresentation } from "../benchmarkCanvasBrowserLayout";
import type { RendererV2MaterialControls } from "../rendererV2PanelMaterials";
import type { RendererV2PanelGeometry } from "../rendererV2PanelGeometry";

interface Props {
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  metricsEnabled: boolean;
  onMetricsEnabledChange: (enabled: boolean) => void;
  onResetMetrics: () => void;
  onStartSample: () => void;
  diagnosticMode: CanvasBrowserDiagnosticMode;
  onDiagnosticModeChange: (mode: CanvasBrowserDiagnosticMode) => void;
  materials: RendererV2MaterialControls;
  panelGeometry: RendererV2PanelGeometry;
  cardGap: number;
  accent: string;
  cardPresentation: BenchmarkCanvasCardPresentation;
  onMaterialsChange: (materials: RendererV2MaterialControls) => void;
  onPanelGeometryChange: (geometry: RendererV2PanelGeometry) => void;
  onCardGapChange: (gap: number) => void;
  onAccentChange: (accent: string) => void;
  onCardPresentationChange: (presentation: BenchmarkCanvasCardPresentation) => void;
}

export function BenchmarkControls({
  store,
  viewport,
  metricsEnabled,
  onMetricsEnabledChange,
  onResetMetrics,
  onStartSample,
  diagnosticMode,
  onDiagnosticModeChange,
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
  const { scene } = store;
  return (
    <Paper className="renderer-benchmark__controls" p="sm" radius="md" shadow="md">
      <Stack gap="xs">
        <div>
          <Title order={3} size="h5">
            Renderer V2 Prototype
          </Title>
          <Text size="xs" c="dimmed">
            UI/design prototype · shared synthetic scene state
          </Text>
        </div>
        {import.meta.env.DEV ? (
          <Select
            label="Canvas Browser diagnostic"
            size="xs"
            value={diagnosticMode}
            data={CANVAS_BROWSER_DIAGNOSTIC_MODES.map((value) => ({
              value,
              label: CANVAS_BROWSER_DIAGNOSTIC_LABELS[value],
            }))}
            onChange={(value) => {
              if (value) onDiagnosticModeChange(value as CanvasBrowserDiagnosticMode);
            }}
          />
        ) : null}
        <div className="renderer-benchmark__workload-sliders">
          <WorkloadSlider
            label="Canvas Cards"
            value={scene.canvasCardCount}
            minimum={BENCHMARK_CANVAS_CARD_COUNT.minimum}
            maximum={BENCHMARK_CANVAS_CARD_COUNT.maximum}
            onChange={(value) => store.setCanvasCardCount(value)}
          />
          <WorkloadSlider
            label="Canvas Elements"
            value={scene.elements.length}
            minimum={BENCHMARK_CANVAS_ELEMENT_COUNT.minimum}
            maximum={BENCHMARK_CANVAS_ELEMENT_COUNT.maximum}
            onChange={(value) => store.setCanvasElementCount(value)}
          />
        </div>
        <Group gap="md">
          <Switch
            size="xs"
            label="Metrics"
            checked={metricsEnabled}
            onChange={(event) => onMetricsEnabledChange(event.currentTarget.checked)}
          />
          <Checkbox
            size="xs"
            label="Animate Canvas Elements"
            checked={scene.animations.moveCards}
            onChange={(event) => store.setAnimation("moveCards", event.currentTarget.checked)}
          />
          <Checkbox
            size="xs"
            label="Move image"
            checked={scene.animations.moveImage}
            onChange={(event) => store.setAnimation("moveImage", event.currentTarget.checked)}
          />
          <Checkbox
            size="xs"
            label="GIF"
            checked={scene.animations.showGif}
            onChange={(event) => store.setAnimation("showGif", event.currentTarget.checked)}
          />
        </Group>
        <Group gap={6} grow>
          <BenchmarkMaterialMenu
            materials={materials}
            panelGeometry={panelGeometry}
            cardGap={cardGap}
            accent={accent}
            cardPresentation={cardPresentation}
            onMaterialsChange={onMaterialsChange}
            onPanelGeometryChange={onPanelGeometryChange}
            onCardGapChange={onCardGapChange}
            onAccentChange={onAccentChange}
            onCardPresentationChange={onCardPresentationChange}
          />
          <Button size="compact-xs" variant="default" onClick={() => viewport.reset()}>
            Reset camera
          </Button>
          <Button
            size="compact-xs"
            variant="default"
            disabled={!metricsEnabled}
            onClick={onResetMetrics}
          >
            Reset metrics
          </Button>
          <Button
            size="compact-xs"
            color="orange"
            disabled={!metricsEnabled}
            onClick={onStartSample}
          >
            Start 10s sample
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Canvas Cards share one Small Panel Container. The fixed Canvas Browser uses one Large
          Panel Container. Scrolling moves one shared Liquid Group.
        </Text>
      </Stack>
    </Paper>
  );
}

function WorkloadSlider({
  label,
  value,
  minimum,
  maximum,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div className="renderer-benchmark__workload-slider">
      <Group justify="space-between" gap="xs">
        <Text size="xs" fw={600}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          {value}
        </Text>
      </Group>
      <Slider
        value={value}
        min={minimum}
        max={maximum}
        step={1}
        thumbLabel={label}
        onChange={onChange}
      />
    </div>
  );
}
