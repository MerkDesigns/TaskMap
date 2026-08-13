import { Button, Checkbox, Group, Paper, Slider, Stack, Switch, Text, Title } from "@mantine/core";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import { BENCHMARK_CANVAS_CARD_COUNT, BENCHMARK_CANVAS_ELEMENT_COUNT } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";

interface Props {
  store: BenchmarkSceneStore;
  viewport: BenchmarkViewportController;
  metricsEnabled: boolean;
  onMetricsEnabledChange: (enabled: boolean) => void;
  onResetMetrics: () => void;
  onStartSample: () => void;
}

export function BenchmarkControls({
  store,
  viewport,
  metricsEnabled,
  onMetricsEnabledChange,
  onResetMetrics,
  onStartSample,
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
