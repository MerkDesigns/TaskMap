import {
  IconArrowsShuffle,
  IconArrowsSort,
  IconCalendarRepeat,
  IconCards,
  IconCheckbox,
  IconColorPicker,
  IconColorSwatch,
  IconLock,
  IconPalette,
  IconSearch,
  IconShieldLock,
} from "@tabler/icons-react";
import { ExtensionId } from "./ExtensionsPanel";

export type ExtensionTargetType = "container" | "text-block" | "text-card" | "image";

export const EXTENSION_DROP_ICONS: Record<ExtensionId, typeof IconShieldLock> = {
  privacy: IconShieldLock,
  lock: IconLock,
  colors: IconPalette,
  colorPicker: IconColorPicker,
  search: IconSearch,
  sorting: IconArrowsSort,
  checkbox: IconCheckbox,
  dailyReset: IconCalendarRepeat,
  counter: IconCards,
  inheritCardColor: IconColorSwatch,
  pickCard: IconArrowsShuffle,
};

export const EXTENSION_COMPATIBLE_TARGETS: Record<ExtensionId, ReadonlySet<ExtensionTargetType>> = {
  privacy: new Set<ExtensionTargetType>(["container", "text-block"]),
  lock: new Set<ExtensionTargetType>(["container", "text-block", "text-card", "image"]),
  colors: new Set<ExtensionTargetType>(["container", "text-block", "text-card", "image"]),
  colorPicker: new Set<ExtensionTargetType>(["container", "text-block"]),
  search: new Set<ExtensionTargetType>(["container"]),
  sorting: new Set<ExtensionTargetType>(["container"]),
  checkbox: new Set<ExtensionTargetType>(["text-card"]),
  dailyReset: new Set<ExtensionTargetType>(["container"]),
  counter: new Set<ExtensionTargetType>(["container"]),
  inheritCardColor: new Set<ExtensionTargetType>(["container"]),
  pickCard: new Set<ExtensionTargetType>(["container"]),
};
