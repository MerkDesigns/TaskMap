import type { MindmapPort } from "./types";

export type MindmapPoint = { x: number; y: number };
export type MindmapBounds = MindmapPoint & { width: number; height: number };

export const getMindmapPortPoint = (mindmap: MindmapBounds, port: MindmapPort): MindmapPoint => {
  switch (port) {
    case "left":
      return { x: mindmap.x, y: mindmap.y + mindmap.height / 2 };
    case "right":
      return { x: mindmap.x + mindmap.width, y: mindmap.y + mindmap.height / 2 };
    case "top":
      return { x: mindmap.x + mindmap.width / 2, y: mindmap.y };
    case "bottom":
      return { x: mindmap.x + mindmap.width / 2, y: mindmap.y + mindmap.height };
  }
};

const portVector = (port: MindmapPort): MindmapPoint => {
  switch (port) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
  }
};

export const getMindmapConnectionPath = (
  source: MindmapPoint,
  sourcePort: MindmapPort,
  target: MindmapPoint,
  targetPort: MindmapPort,
) => {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const sourceVector = portVector(sourcePort);
  const targetVector = portVector(targetPort);
  const baseControlDistance = Math.min(220, distance * 0.34);
  const sourceForwardDistance =
    (target.x - source.x) * sourceVector.x + (target.y - source.y) * sourceVector.y;
  const targetForwardDistance =
    (source.x - target.x) * targetVector.x + (source.y - target.y) * targetVector.y;
  const sourceControlDistance =
    sourceForwardDistance > 0
      ? Math.min(baseControlDistance, sourceForwardDistance * 0.34)
      : baseControlDistance;
  const targetControlDistance =
    targetForwardDistance > 0
      ? Math.min(baseControlDistance, targetForwardDistance * 0.34)
      : baseControlDistance;
  const sourceControl = {
    x: source.x + sourceVector.x * sourceControlDistance,
    y: source.y + sourceVector.y * sourceControlDistance,
  };
  const targetControl = {
    x: target.x + targetVector.x * targetControlDistance,
    y: target.y + targetVector.y * targetControlDistance,
  };
  return `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${target.x} ${target.y}`;
};

export const getMindmapConnectionPreviewPath = (
  source: MindmapPoint,
  sourcePort: MindmapPort,
  target: MindmapPoint,
) => {
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const controlDistance = Math.min(180, distance * 0.32);
  const sourceVector = portVector(sourcePort);
  const sourceControl = {
    x: source.x + sourceVector.x * controlDistance,
    y: source.y + sourceVector.y * controlDistance,
  };
  const targetControl = {
    x: sourceControl.x + (target.x - sourceControl.x) * 0.72,
    y: sourceControl.y + (target.y - sourceControl.y) * 0.72,
  };
  return `M ${source.x} ${source.y} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${target.x} ${target.y}`;
};
