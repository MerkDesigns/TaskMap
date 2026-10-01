import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  type ForwardedRef,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { MaterialSurface } from "../../materials/MaterialSurface";
import { ScrollArea } from "../../primitives/Layout";
import { LiquidToggleSwitch } from "../../primitives/LiquidToggleSwitch";
import { GlassListFrame } from "../workspace/GlassListFrame";
import { useSharedSmallGlassList } from "../workspace/useSharedSmallGlassList";
import { useWorkspaceRadii } from "../workspace/workspaceRadii";
import "./SettingsPatterns.css";

const SettingsIslandBatch = createContext(false);

export const SettingsShell = forwardRef<HTMLDivElement, HTMLAttributes<HTMLElement>>(
  function SettingsShell({ className, ...props }, ref) {
    return (
      <MaterialSurface
        {...props}
        ref={ref as ForwardedRef<HTMLElement>}
        material="acrylic-large"
        radius={useWorkspaceRadii().settings}
        className={["taskmap-settings-shell", className].filter(Boolean).join(" ")}
      />
    );
  },
);

export const SettingsIsland = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function SettingsIsland({ children, className, ...props }, ref) {
    const batched = useContext(SettingsIslandBatch);
    const radius = useWorkspaceRadii().settingsIsland;
    return (
      <MaterialSurface
        {...props}
        ref={ref}
        material="acrylic-small"
        backdropSource={batched ? "shared" : undefined}
        geometrySource={batched ? "owner" : undefined}
        data-settings-island={batched || undefined}
        radius={radius}
        as="section"
        className={["taskmap-settings-island", className].filter(Boolean).join(" ")}
      >
        {/* Clipped to the island silhouette, and to its visible slice at the scroll edges. */}
        <div className="taskmap-glass-list__content taskmap-settings-island__content">
          {children}
        </div>
      </MaterialSurface>
    );
  },
);

/**
 * Scrollable Settings content. Its islands share one settled Minor batch over the Settings shell
 * and morph to their visible slice at the scroll edges, like the workspace browser lists; Minors
 * nested on an island (toggle knobs) render as shells per the glass contract.
 */
export const SettingsIslandList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function SettingsIslandList({ children, className, ...props }, ref) {
    const planeRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    useSharedSmallGlassList({
      active: true,
      cardSelector: "[data-settings-island]",
      morph: true,
      planeRef,
      viewportRef,
    });
    return (
      <GlassListFrame
        ref={ref}
        className="taskmap-settings-scroll-frame"
        planeRef={planeRef}
        batchId="settings-small"
      >
        <ScrollArea
          {...props}
          ref={viewportRef}
          scrollbar="hidden"
          className={["taskmap-settings-scroll", className].filter(Boolean).join(" ")}
        >
          <SettingsIslandBatch.Provider value>{children}</SettingsIslandBatch.Provider>
        </ScrollArea>
      </GlassListFrame>
    );
  },
);

export interface SettingsRowProps extends HTMLAttributes<HTMLDivElement> {
  readonly description?: ReactNode;
  readonly leading?: ReactNode;
  readonly label: ReactNode;
  readonly control?: ReactNode;
}

export const SettingsRow = forwardRef<HTMLDivElement, SettingsRowProps>(function SettingsRow(
  { className, control, description, label, leading, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      className={["taskmap-settings-row", className].filter(Boolean).join(" ")}
    >
      {leading ? <span className="taskmap-settings-row__leading">{leading}</span> : null}
      <span className="taskmap-settings-row__copy">
        <span className="taskmap-settings-row__label">{label}</span>
        {description ? (
          <span className="taskmap-settings-row__description">{description}</span>
        ) : null}
      </span>
      {control ? <span className="taskmap-settings-row__control">{control}</span> : null}
    </div>
  );
});

export interface SettingsToggleRowProps extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  readonly checked: boolean;
  readonly description: ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly leading?: ReactNode;
  readonly onCheckedChange: (checked: boolean) => void;
}

export function SettingsToggleRow({
  checked,
  className,
  description,
  disabled = false,
  label,
  leading,
  onCheckedChange,
  onClick,
  ...props
}: SettingsToggleRowProps) {
  const handleRowClick = (event: MouseEvent<HTMLElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, select, textarea, a")) return;
    onCheckedChange(!checked);
  };

  return (
    <SettingsIsland
      {...props}
      data-disabled={disabled || undefined}
      className={["taskmap-settings-toggle-row", className].filter(Boolean).join(" ")}
      onClick={handleRowClick}
    >
      <SettingsRow
        leading={leading}
        label={label}
        description={description}
        control={
          <LiquidToggleSwitch
            checked={checked}
            disabled={disabled}
            label={label}
            onCheckedChange={onCheckedChange}
          />
        }
      />
    </SettingsIsland>
  );
}
