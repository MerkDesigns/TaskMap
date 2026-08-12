export interface CanvasReorderRow<Id extends string = string> {
  readonly id: Id;
  readonly top: number;
  readonly height: number;
}

export function reorderAtPointerMidpoint<Id extends string>(
  order: readonly Id[],
  rows: readonly CanvasReorderRow<Id>[],
  draggedId: Id,
  pointerY: number,
  previousPointerY: number,
): readonly Id[] {
  const index = order.indexOf(draggedId);
  if (index < 0 || pointerY === previousPointerY) return order;
  const direction = pointerY > previousPointerY ? 1 : -1;
  const neighborIndex = index + direction;
  const neighborId = order[neighborIndex];
  const neighbor = rows.find((row) => row.id === neighborId);
  if (!neighbor) return order;
  const midpoint = neighbor.top + neighbor.height / 2;
  if ((direction > 0 && pointerY < midpoint) || (direction < 0 && pointerY > midpoint)) {
    return order;
  }
  const next = [...order];
  next.splice(index, 1);
  next.splice(neighborIndex, 0, draggedId);
  return next;
}
