import { Menu } from "@mantine/core";
import type { BenchmarkSceneStore } from "./benchmarkSceneStore";
import type { BenchmarkSpawnMenuRequest } from "./useBenchmarkCanvasInput";

interface Props {
  request: BenchmarkSpawnMenuRequest | null;
  store: BenchmarkSceneStore;
  onClose: () => void;
}

export function BenchmarkSpawnMenu({ request, store, onClose }: Props) {
  const spawn = (kind: "text-card" | "container") => {
    if (request) store.addElement(kind, request.world);
    onClose();
  };
  return (
    <Menu
      opened={Boolean(request)}
      onChange={(opened) => !opened && onClose()}
      position="bottom-start"
      withinPortal
    >
      <Menu.Target>
        <button
          className="renderer-benchmark__context-anchor"
          style={{ left: request?.screen.x ?? -100, top: request?.screen.y ?? -100 }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Spawn at pointer</Menu.Label>
        <Menu.Item onClick={() => spawn("text-card")}>Spawn Text Card</Menu.Item>
        <Menu.Item onClick={() => spawn("container")}>Spawn Container</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
