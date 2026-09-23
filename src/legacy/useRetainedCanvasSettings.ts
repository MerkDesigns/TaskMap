import {
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type SetStateAction,
} from "react";
import { RetainedCanvasContext } from "./RetainedCanvasContext";
import type { useLegacyCanvasSettings } from "./useLegacyCanvasSettings";
import type { DevicePreferences } from "../platform/settings/preferenceContracts";
import type { CanvasGridStyle } from "../types";
import type { RetainedSettingsUpdate } from "../app/commands/retainedSettingsCommand";
import type { RetainedSettingField } from "../app/commands/retainedSettingsCallbacks";
import type { CapturedCompletion } from "../app/commands/retainedCompletionOwner";

const resolve = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (current: T) => T)(current) : value;

/** Settings values come from their document/device owners; only an in-progress slider is local. */
export function useRetainedCanvasSettings(): ReturnType<typeof useLegacyCanvasSettings> {
  const context = useContext(RetainedCanvasContext);
  if (!context) throw new Error("Settings require the canvas session.");
  const { runtime, binding } = context;
  const snapshot = useSyncExternalStore(
    binding.subscribe,
    binding.getSnapshot,
    binding.getSnapshot,
  );
  const preferenceState = useSyncExternalStore(
    runtime.preferences.subscribe,
    runtime.preferences.getSnapshot,
    runtime.preferences.getSnapshot,
  );
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [gridDraft, setGridDraft] = useState<Record<CanvasGridStyle, number> | null>(null);
  const pending = useRef<{
    capture: CapturedCompletion<RetainedSettingsUpdate | null>;
    style: CanvasGridStyle;
    value: number;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const cancel = () => {
      pending.current?.capture.cancel();
      pending.current = null;
      setGridDraft(null);
    };
    const unsubscribe = runtime.callbacks.subscribeInvalidation(cancel);
    return () => {
      mounted.current = false;
      unsubscribe();
      pending.current?.capture.cancel();
      pending.current = null;
    };
  }, [runtime]);
  if (snapshot.phase !== "ready" || !preferenceState) throw new Error("Settings are not ready.");
  const settings = snapshot.settings;
  const preferences = preferenceState.preferences;
  const readSettings = () =>
    runtime.controller.store.getState().documentWorkspace.document?.documentSettings;
  const report = (ok: boolean) => {
    if (mounted.current)
      setSettingsError(ok ? null : "The setting could not be saved. Please retry the change.");
  };
  const complete = (fields: readonly RetainedSettingField[], update: RetainedSettingsUpdate) =>
    report(runtime.callbacks.captureDocumentSettings(fields)?.complete(update).ok ?? false);
  const preferenceSetter =
    <K extends keyof DevicePreferences>(key: K) =>
    (value: SetStateAction<DevicePreferences[K]>) => {
      void runtime.preferences
        .update((current) => ({ [key]: resolve(value, current[key]) }))
        .then((result) => report(result.ok));
    };
  const cancelOpacity = () => {
    pending.current?.capture.cancel();
    pending.current = null;
    setGridDraft(null);
  };
  const booleanSetting =
    (field: "showElementShadows" | "allowLockedElementDeletion" | "minimapEnabled") =>
    (value: SetStateAction<boolean>) => {
      const current = readSettings();
      if (current) complete([field], { [field]: resolve(value, current[field]) });
    };
  return {
    settingsError,
    canvasGridStyle: settings.grid.style,
    setCanvasGridStyle(value) {
      cancelOpacity();
      const current = readSettings();
      if (current)
        complete(["grid.style"], { grid: { style: resolve(value, current.grid.style) } });
    },
    canvasGridOpacity: gridDraft ?? settings.grid.opacityPercent,
    setCanvasGridOpacity(value) {
      const current = readSettings();
      if (!current) return;
      const opacity = resolve(value, gridDraft ?? current.grid.opacityPercent);
      if (pending.current) {
        pending.current.value = opacity[pending.current.style];
        setGridDraft(opacity);
      } else {
        const fields = (["dots", "lines"] as const).filter(
          (style) => opacity[style] !== current.grid.opacityPercent[style],
        );
        if (fields.length)
          complete(
            fields.map((style) => `grid.opacityPercent.${style}` as const),
            {
              grid: {
                opacityPercent: Object.fromEntries(fields.map((style) => [style, opacity[style]])),
              },
            },
          );
      }
    },
    gridOpacityEdit: {
      begin() {
        cancelOpacity();
        const current = readSettings();
        if (!current) return;
        const style = current.grid.style;
        const capture = runtime.callbacks.captureDocumentSettings([`grid.opacityPercent.${style}`]);
        if (capture)
          pending.current = { capture, style, value: current.grid.opacityPercent[style] };
      },
      commit() {
        const edit = pending.current;
        pending.current = null;
        setGridDraft(null);
        if (edit)
          report(
            edit.capture.complete({ grid: { opacityPercent: { [edit.style]: edit.value } } }).ok,
          );
      },
      cancel: cancelOpacity,
    },
    defaultElementColors: preferences.defaultElementColors,
    setDefaultElementColors: preferenceSetter("defaultElementColors"),
    recentColors: preferences.recentColors,
    setRecentColors: preferenceSetter("recentColors"),
    shadowsUnderElements: settings.showElementShadows,
    setShadowsUnderElements: booleanSetting("showElementShadows"),
    allowLockedElementDeletion: settings.allowLockedElementDeletion,
    setAllowLockedElementDeletion: booleanSetting("allowLockedElementDeletion"),
    minimapEnabled: settings.minimapEnabled,
    setMinimapEnabled: booleanSetting("minimapEnabled"),
    privacyModeEnabled: preferences.privacyModeEnabled,
    setPrivacyModeEnabled: (value) => {
      void runtime.privacy.update(value).then((result) => report(result.ok));
    },
    toolbarButtonsVisible: preferences.toolbarButtonsVisible,
    setToolbarButtonsVisible: preferenceSetter("toolbarButtonsVisible"),
    dismissedUpdateVersion: preferences.dismissedUpdateVersion ?? undefined,
    setDismissedUpdateVersion(value) {
      void runtime.preferences
        .update((current) => ({
          dismissedUpdateVersion:
            resolve(value, current.dismissedUpdateVersion ?? undefined) ?? null,
        }))
        .then((result) => report(result.ok));
    },
    discordRpcEnabled: false,
    discordRpcShowCanvas: false,
    setDiscordRpcEnabled: () => report(false),
    setDiscordRpcShowCanvas: () => report(false),
  };
}
