import { createElement, type HTMLAttributes } from "react";
import { primitiveClassNames } from "./primitiveClassNames";
import "./typography.css";

export type TextRole =
  | "body"
  | "body-small"
  | "label"
  | "caption"
  | "heading"
  | "section-heading"
  | "muted"
  | "monospace";

export interface TextProps extends HTMLAttributes<HTMLElement> {
  readonly as?: "span" | "p" | "h1" | "h2" | "h3";
  readonly roleName?: TextRole;
}

export function Text({ as = "span", className, roleName = "body", ...props }: TextProps) {
  return createElement(as, {
    ...props,
    className: primitiveClassNames("taskmap-text", `taskmap-text--${roleName}`, className),
  });
}
