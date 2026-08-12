import {
  Button,
  Checkbox,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkViewportController } from "./benchmarkViewportController";
import type { BenchmarkArchitecture } from "./benchmarkTypes";

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
            Renderer V2 benchmark
          </Title>
          <Text size="xs" c="dimmed">
            Development-only · shared scene state
          </Text>
        </div>
        <SegmentedControl
          fullWidth
          value={scene.architecture}
          onChange={(value) => store.setArchitecture(value as BenchmarkArchitecture)}
          data={[
            { value: "A", label: "A · Plain" },
            { value: "B", label: "B · Coarse" },
            { value: "C", label: "C · Group" },
          ]}
        />
        <Group gap={6} grow>
          <Button size="xs" onClick={() => store.addGlass()}>
            + Glass
          </Button>
          <Button size="xs" onClick={() => store.addElement("text-card")}>
            + Text
          </Button>
          <Button size="xs" onClick={() => store.addElement("container")}>
            + Container
          </Button>
        </Group>
        <Group gap={6} grow>
          <Button size="compact-xs" variant="light" onClick={() => store.addBulk("text-card", 10)}>
            +10 Text
          </Button>
          <Button size="compact-xs" variant="light" onClick={() => store.addBulk("text-card", 50)}>
            +50 Text
          </Button>
          <Button size="compact-xs" variant="light" onClick={() => store.addBulk("text-card", 100)}>
            +100 Text
          </Button>
          <Button size="compact-xs" variant="light" onClick={() => store.addBulk("container", 10)}>
            +10 Containers
          </Button>
        </Group>
        <Group gap="md">
          <Switch
            size="xs"
            label="Metrics"
            checked={metricsEnabled}
            onChange={(event) => onMetricsEnabledChange(event.currentTarget.checked)}
          />
          <Checkbox
            size="xs"
            label="Move cards"
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
          <Button size="compact-xs" variant="default" onClick={() => store.clearCanvas()}>
            Clear canvas
          </Button>
          <Button size="compact-xs" variant="default" onClick={() => store.clearGlass()}>
            Clear glass
          </Button>
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
          Mode A keeps element z inside its transformed world and outline z at the chrome boundary.
          Mode B can place glass only before or after its single coarse Html layer. Mode C can
          interleave element Html and independent glass Containers by scene z.
        </Text>
      </Stack>
    </Paper>
  );
}
