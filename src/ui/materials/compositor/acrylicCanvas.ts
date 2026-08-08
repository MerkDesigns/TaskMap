export interface AcrylicCanvas2DContext {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  filter: string;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  clearRect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  clip(): void;
  fill(): void;
  stroke(): void;
  drawImage(source: object, destinationX: number, destinationY: number): void;
}

export interface AcrylicCanvasSurface {
  readonly width: number;
  readonly height: number;
  readonly context: AcrylicCanvas2DContext;
  readonly imageSource: object;
}

export interface AcrylicCanvasFactory {
  create(width: number, height: number, alpha: boolean): AcrylicCanvasSurface;
}

export interface TransferableCacheBitmap {
  readonly width: number;
  readonly height: number;
  close(): void;
}

export interface AcrylicBitmapFactory<Bitmap extends TransferableCacheBitmap> {
  create(surface: AcrylicCanvasSurface): Bitmap | Promise<Bitmap>;
}
