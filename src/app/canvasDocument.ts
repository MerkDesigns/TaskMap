import { clamp } from "../canvasMath";
import type { TaskCanvas } from "../types";

type CanvasDetails = Pick<TaskCanvas, "name" | "width" | "height">;

export const updateCanvasDetails = (
  canvas: TaskCanvas,
  { name, width, height }: CanvasDetails,
): TaskCanvas => ({
  ...canvas,
  name,
  width,
  height,
  containers: canvas.containers.map((element) => ({
    ...element,
    x: clamp(element.x, 0, Math.max(0, width - element.width)),
    y: clamp(element.y, 0, Math.max(0, height - element.height)),
    width: Math.min(element.width, width),
    height: Math.min(element.height, height),
  })),
  textCards: canvas.textCards.map((card) => ({
    ...card,
    x: clamp(card.x, 0, width),
    y: clamp(card.y, 0, height),
  })),
  textBlocks: canvas.textBlocks.map((element) => ({
    ...element,
    x: clamp(element.x, 0, Math.max(0, width - element.width)),
    y: clamp(element.y, 0, Math.max(0, height - element.height)),
    width: Math.min(element.width, width),
    height: Math.min(element.height, height),
  })),
  images: canvas.images.map((image) => ({
    ...image,
    x: clamp(image.x, 0, Math.max(0, width - image.width)),
    y: clamp(image.y, 0, Math.max(0, height - image.height)),
    width: Math.min(image.width, width),
    height: Math.min(image.height, height),
  })),
});

export type CanvasDeletionPlan = {
  containerIds: string[];
  textCardIds: string[];
  textBlockIds: string[];
  imageIds: string[];
};

export const planCanvasDeletion = (
  canvas: Pick<TaskCanvas, "containers" | "textCards" | "textBlocks" | "images">,
  actionIds: string[],
  isDeletionLocked: (id: string) => boolean,
): CanvasDeletionPlan => {
  const actionIdSet = new Set(actionIds);
  const containerIds = canvas.containers
    .filter(({ id }) => actionIdSet.has(id) && !isDeletionLocked(id))
    .map(({ id }) => id);
  const removedContainerIds = new Set(containerIds);
  const isIndividuallyRemovable = (id: string) => actionIdSet.has(id) && !isDeletionLocked(id);

  return {
    containerIds,
    textCardIds: canvas.textCards
      .filter(
        ({ id, containerId }) =>
          isIndividuallyRemovable(id) && (!containerId || !removedContainerIds.has(containerId)),
      )
      .map(({ id }) => id),
    textBlockIds: canvas.textBlocks
      .filter(({ id }) => isIndividuallyRemovable(id))
      .map(({ id }) => id),
    imageIds: canvas.images
      .filter(
        ({ id, containerId }) =>
          isIndividuallyRemovable(id) && (!containerId || !removedContainerIds.has(containerId)),
      )
      .map(({ id }) => id),
  };
};
