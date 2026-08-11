import { createContext } from "react";
import type { LiquidDomRuntime } from "./liquidDomRuntime";

export interface LiquidDomContextValue {
  readonly root: HTMLElement | null;
  readonly runtime: LiquidDomRuntime | null;
}

export const LiquidDomContext = createContext<LiquidDomContextValue>({
  root: null,
  runtime: null,
});
