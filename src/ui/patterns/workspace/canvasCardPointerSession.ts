export class CanvasCardPointerSession {
  private element: HTMLElement | null = null;
  private pointerId: number | null = null;
  private onMove: ((event: PointerEvent) => void) | null = null;
  private onFinish: ((event: PointerEvent, finish: "commit" | "cancel") => void) | null = null;

  begin(
    element: HTMLElement,
    pointerId: number,
    onMove: (event: PointerEvent) => void,
    onFinish: (event: PointerEvent, finish: "commit" | "cancel") => void,
  ) {
    this.element = element;
    this.pointerId = pointerId;
    this.onMove = onMove;
    this.onFinish = onFinish;
    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Document listeners remain authoritative when pointer capture is unavailable.
    }
    document.addEventListener("pointermove", this.handleMove);
    document.addEventListener("pointerup", this.handleUp);
    document.addEventListener("pointercancel", this.handleCancel);
  }

  release(pointerId: number) {
    try {
      if (this.element?.hasPointerCapture(pointerId)) this.element.releasePointerCapture(pointerId);
    } catch {
      // Pointer capture is best-effort; listeners are always removed.
    } finally {
      this.removeListeners();
    }
  }

  private readonly handleMove = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) this.onMove?.(event);
  };

  private readonly handleUp = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) this.onFinish?.(event, "commit");
  };

  private readonly handleCancel = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) this.onFinish?.(event, "cancel");
  };

  private removeListeners() {
    document.removeEventListener("pointermove", this.handleMove);
    document.removeEventListener("pointerup", this.handleUp);
    document.removeEventListener("pointercancel", this.handleCancel);
    this.element = null;
    this.pointerId = null;
    this.onMove = null;
    this.onFinish = null;
  }
}
