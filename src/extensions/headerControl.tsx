import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ComponentType, SyntheticEvent } from "react";
import type { ElementExtensions } from "../types";
import type { ExtensionCommands } from "./extensionCommands";
import type { RetainedExtensionKey } from "./retainedExtensionDefinition";

/** The element types whose header shows extension controls. */
export type HeaderHost = "container" | "text-block";

/** What a header control sees of the element it sits on. */
export interface HeaderControlContext {
  readonly elementId: string;
  readonly host: HeaderHost;
  /** Installed extensions, from the retained extension projection. */
  readonly extensions: ElementExtensions;
  readonly accent: string;
  readonly cardCount: number;
  readonly recentColors: readonly string[];
}

/** Where a panel opens: the pressed button's rectangle, captured when it was pressed. */
export interface HeaderPanelAnchor {
  readonly rect: DOMRect;
  readonly element: HTMLElement;
}

export interface HeaderControlProps {
  readonly context: HeaderControlContext;
  readonly commands: ExtensionCommands;
  /** This control's panel is open; its button shows as active. */
  readonly panelOpen: boolean;
  /** Opens or closes this control's panel, anchored to the pressed button. */
  readonly togglePanel: (anchor: HTMLElement) => void;
}

export interface HeaderPanelProps {
  readonly context: HeaderControlContext;
  readonly commands: ExtensionCommands;
  readonly open: boolean;
  /** The anchor of the last opening; kept while the panel animates closed. */
  readonly anchor: HeaderPanelAnchor | null;
  readonly close: () => void;
}

export interface HeaderControl {
  readonly extension: RetainedExtensionKey;
  readonly hosts: readonly HeaderHost[];
  /** Fixed per control, so the header's fit-beside-the-title layout never waits for a render. */
  readonly width: (context: HeaderControlContext) => number;
  readonly Control: ComponentType<HeaderControlProps>;
  /** A popover the control opens; the host keeps it so it outlives the overflow popover. */
  readonly Panel?: ComponentType<HeaderPanelProps>;
}

export const HEADER_BUTTON_WIDTH = 36;

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** A header button with the host's chrome (elementHeader.css); presses never start a move. */
export const HeaderControlButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { readonly active?: boolean }
>(function HeaderControlButton({ active, onClick, ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      className="taskmap-element-header__button"
      data-active={active || undefined}
      onPointerDown={stopPropagation}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
    />
  );
});

/** Container headers use larger glyphs than the compact text-block header. */
export const headerIconSize = (host: HeaderHost, containerSize: number) =>
  host === "container" ? containerSize : 18;
