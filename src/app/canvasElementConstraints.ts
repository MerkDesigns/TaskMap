// The retained canvas-details operation clamps stored coordinates, including locked elements.
// Content-sized cards/nodes keep their canonical extents. No pointer-frame or measurement work.
export function constrainCanvasElement<
  T extends { x: number; y: number; width: number; height: number },
>(element: T, width: number, height: number, contentSized = false): T {
  const clamp = (value: number, maximum: number) =>
    Math.min(Math.max(value, 0), Math.max(0, maximum));
  return {
    ...element,
    x: clamp(element.x, contentSized ? width : width - element.width),
    y: clamp(element.y, contentSized ? height : height - element.height),
    width: contentSized ? element.width : Math.min(element.width, width),
    height: contentSized ? element.height : Math.min(element.height, height),
  };
}
