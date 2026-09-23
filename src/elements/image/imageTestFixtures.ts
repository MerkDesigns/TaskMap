import { asEntityId } from "../../domain/ids/entityIds";
import { createCardContainerInput, TEST_IDS } from "../cardContainerTestFixtures";

export const IMAGE_TEST_IDS = {
  image: asEntityId("element", "element-00000000-0000-4000-8000-000000000020"),
  secondImage: asEntityId("element", "element-00000000-0000-4000-8000-000000000021"),
  secondMedia: asEntityId("media", "abcdefghijklmnopqrstuvwY"),
};

export function createImageInput() {
  const input = createCardContainerInput();
  const id = IMAGE_TEST_IDS.image;
  input.elements[id] = {
    id,
    canvasId: TEST_IDS.canvasA,
    type: "image",
    geometry: { x: 50, y: 60, width: 320, height: 240 },
    data: {
      mediaId: TEST_IDS.media,
      accent: "#abc",
      background: false,
      placement: { containerId: TEST_IDS.elementA, order: 4 },
    },
  };
  input.canvases[TEST_IDS.canvasA].elementOrder.push(id);
  input.mediaReferences[TEST_IDS.media] = {
    id: TEST_IDS.media,
    mimeType: "image/webp",
    byteLength: 1024,
    pixelWidth: 640,
    pixelHeight: 480,
    altText: "Diagram 🖼️",
  };
  return input;
}
