import type { ComponentType } from "react";
import type { ZodType } from "zod";
import type { DocumentElement, TaskMapDocument } from "../domain/document/documentTypes";
import type { CanvasId, ElementId } from "../domain/ids/entityIds";

export interface ElementBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CreateElementContext {
  readonly id: ElementId;
  readonly canvasId: CanvasId;
}

export interface ElementRendererProps<Element extends DocumentElement = DocumentElement> {
  readonly element: Element;
  readonly selected: boolean;
}

export interface ElementDefinition<Element extends DocumentElement = DocumentElement> {
  readonly type: Element["type"];
  readonly schema: ZodType<Element>;
  readonly createDefault: (context: CreateElementContext) => Element;
  readonly Renderer: ComponentType<ElementRendererProps<Element>>;
  readonly getBounds: (element: Element) => ElementBounds;
  readonly validate: (document: TaskMapDocument, element: Element) => readonly string[];
}
