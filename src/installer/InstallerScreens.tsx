import type { ReactNode } from "react";
import { IconArrowLeft, IconArrowRight, IconCheck, IconFolder } from "@tabler/icons-react";
import { Button } from "../ui/primitives/Button";
import { Checkbox } from "../ui/primitives/SelectionControls";
import type {
  InstallFailure,
  InstallStage,
  InstallerDetails,
} from "../platform/installer/installerClient";
import { compareVersions, type InstallOptions } from "./installerFlow";
import taskmapMark from "../../src-tauri/icons/128x128@2x.png";
import taskmapWordmark from "./taskmapWordmark.png";

function HeroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="taskmap-installer__hero">
      <div className="taskmap-installer__mark">
        <img src={taskmapMark} alt="" draggable={false} />
      </div>
      <div className="taskmap-installer__hero-copy">{children}</div>
    </div>
  );
}

export function WelcomeScreen({
  details,
  onInstall,
  onOptions,
}: {
  details: InstallerDetails;
  onInstall(): void;
  onOptions(): void;
}) {
  return (
    <>
      <HeroLayout>
        <h1>
          Welcome to
          <img
            className="taskmap-installer__wordmark"
            src={taskmapWordmark}
            alt={details.productName}
            draggable={false}
          />
        </h1>
        <p className="taskmap-installer__lead">Organize everything visually.</p>
        <p className="taskmap-installer__body">
          Plan, structure and track your work on a flexible, encrypted canvas.
        </p>
        <Button
          variant="primary"
          className="taskmap-installer__primary"
          trailingIcon={<IconArrowRight size={18} stroke={2} />}
          onClick={onInstall}
          autoFocus
        >
          Install
        </Button>
      </HeroLayout>
      <footer className="taskmap-installer__footer">
        <span>Version {details.version}</span>
        <Button variant="ghost" size="compact" onClick={onOptions}>
          Options
        </Button>
      </footer>
    </>
  );
}

export function UpdateScreen({
  details,
  actionLabel,
  onUpdate,
  onOptions,
}: {
  details: InstallerDetails;
  actionLabel: InstallerAction;
  onUpdate(): void;
  onOptions(): void;
}) {
  const installed = details.existing?.version ?? "";
  const order = compareVersions(details.version, installed);
  const title = `${actionLabel} TaskMap`;
  const summary =
    order > 0
      ? `Version ${installed} is installed. This updates it to ${details.version}.`
      : order === 0
        ? `Version ${installed} is already installed. Reinstalling repairs it.`
        : `A newer version (${installed}) is installed. This replaces it with ${details.version}.`;
  return (
    <>
      <HeroLayout>
        <h1>{title}</h1>
        <p className="taskmap-installer__body">{summary}</p>
        <p className="taskmap-installer__body">
          Your databases and settings stay exactly as they are.
        </p>
        <p className="taskmap-installer__path" title={details.existing?.location}>
          <IconFolder size={15} stroke={1.8} aria-hidden="true" />
          <span>{details.existing?.location}</span>
        </p>
        <Button
          variant="primary"
          className="taskmap-installer__primary"
          trailingIcon={<IconArrowRight size={18} stroke={2} />}
          onClick={onUpdate}
          autoFocus
        >
          {actionLabel}
        </Button>
      </HeroLayout>
      <footer className="taskmap-installer__footer">
        <span>Version {details.version}</span>
        <Button variant="ghost" size="compact" onClick={onOptions}>
          Options
        </Button>
      </footer>
    </>
  );
}

export function OptionsScreen({
  options,
  updating,
  actionLabel,
  onBrowse,
  onShortcut,
  onBack,
  onInstall,
}: {
  options: InstallOptions;
  updating: boolean;
  actionLabel: InstallerAction;
  onBrowse(): void;
  onShortcut(shortcut: "startMenu" | "desktop", on: boolean): void;
  onBack(): void;
  onInstall(): void;
}) {
  return (
    <div className="taskmap-installer__page">
      <h2>Install options</h2>
      <p className="taskmap-installer__body">
        {updating
          ? "Updates install into the existing TaskMap folder and keep its shortcuts."
          : "Choose where TaskMap is installed and which shortcuts to create."}
      </p>
      <div className="taskmap-installer__location">
        <span className="taskmap-installer__location-path" title={options.location}>
          <IconFolder size={16} stroke={1.8} aria-hidden="true" />
          <span>{options.location}</span>
        </span>
        <Button onClick={onBrowse} disabled={updating}>
          Browse…
        </Button>
      </div>
      <div className="taskmap-installer__checks">
        <Checkbox
          label="Create a Start Menu shortcut"
          checked={options.startMenuShortcut}
          disabled={updating}
          onChange={(event) => onShortcut("startMenu", event.currentTarget.checked)}
        />
        <Checkbox
          label="Create a desktop shortcut"
          checked={options.desktopShortcut}
          disabled={updating}
          onChange={(event) => onShortcut("desktop", event.currentTarget.checked)}
        />
      </div>
      <footer className="taskmap-installer__actions">
        <Button leadingIcon={<IconArrowLeft size={16} stroke={2} />} onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          trailingIcon={<IconArrowRight size={16} stroke={2} />}
          onClick={onInstall}
        >
          {actionLabel}
        </Button>
      </footer>
    </div>
  );
}

export type InstallerAction = "Install" | "Update" | "Reinstall";

const ACTION_PROGRESS: Record<InstallerAction, string> = {
  Install: "Installing",
  Update: "Updating",
  Reinstall: "Reinstalling",
};

const STAGE_LABELS: Record<InstallStage, string> = {
  preparing: "Preparing installation",
  installing: "Installing files",
  shortcuts: "Creating shortcuts",
  finishing: "Finishing up",
};

export function InstallingScreen({
  stage,
  withShortcuts,
  actionLabel,
}: {
  stage: InstallStage | null;
  withShortcuts: boolean;
  actionLabel: InstallerAction;
}) {
  const stages: InstallStage[] = withShortcuts
    ? ["preparing", "installing", "shortcuts", "finishing"]
    : ["preparing", "installing", "finishing"];
  const current = stage ? stages.indexOf(stage) : -1;
  // Silent NSIS reports no finer progress, so the bar sits halfway through the active stage.
  const progress = current < 0 ? 0 : (current + 0.5) / stages.length;
  return (
    <div className="taskmap-installer__page">
      <h2>{ACTION_PROGRESS[actionLabel]} TaskMap</h2>
      <p className="taskmap-installer__body">This only takes a few seconds.</p>
      <ol className="taskmap-installer__stages">
        {stages.map((item, index) => {
          const state = index < current ? "done" : index === current ? "active" : "pending";
          return (
            <li key={item} data-state={state}>
              <span className="taskmap-installer__stage-dot" aria-hidden="true">
                {state === "done" ? <IconCheck size={12} stroke={3} /> : null}
              </span>
              {STAGE_LABELS[item]}
            </li>
          );
        })}
      </ol>
      <div
        className="taskmap-installer__progress"
        role="progressbar"
        aria-label="Installation progress"
        aria-valuemin={0}
        aria-valuemax={stages.length}
        aria-valuenow={Math.max(0, current)}
      >
        <span
          className="taskmap-installer__progress-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}

export function FinishedScreen({
  details,
  actionLabel,
  launch,
  onLaunchChange,
  onFinish,
}: {
  details: InstallerDetails;
  actionLabel: InstallerAction;
  launch: boolean;
  onLaunchChange(launch: boolean): void;
  onFinish(): void;
}) {
  return (
    <HeroLayout>
      <h1>TaskMap is ready</h1>
      <p className="taskmap-installer__body">
        {actionLabel === "Update"
          ? `TaskMap was updated to version ${details.version}.`
          : `TaskMap ${details.version} was ${actionLabel === "Install" ? "installed" : "reinstalled"} on your computer.`}
      </p>
      <Checkbox
        label="Launch TaskMap now"
        checked={launch}
        onChange={(event) => onLaunchChange(event.currentTarget.checked)}
      />
      <Button variant="primary" className="taskmap-installer__primary" onClick={onFinish} autoFocus>
        Finish
      </Button>
    </HeroLayout>
  );
}

export function LegacyInstalledScreen({ onClose }: { onClose(): void }) {
  return (
    <div className="taskmap-installer__page">
      <h2>The current TaskMap is installed</h2>
      <p className="taskmap-installer__body" role="alert">
        This version uses a new database format. Installing it would replace your current TaskMap,
        which is the only version that can open your existing data.
      </p>
      <p className="taskmap-installer__body">
        Install TaskMap Beta instead: it runs alongside your current TaskMap and leaves it and its
        data untouched.
      </p>
      <footer className="taskmap-installer__actions">
        <span />
        <Button variant="primary" onClick={onClose} autoFocus>
          Close
        </Button>
      </footer>
    </div>
  );
}

const FAILURE_MESSAGES: Record<InstallFailure, string> = {
  invalidLocation: "That folder can't be used. Choose a different install location.",
  prepare: "The installer couldn't prepare its files. Check that there is free disk space.",
  start: "Windows couldn't start the installation.",
  failed: "The installation didn't complete. If TaskMap is open, close it and try again.",
  notFound: "TaskMap was installed, but its shortcuts couldn't be created.",
  shortcut: "TaskMap was installed, but its shortcuts couldn't be created.",
  legacyInstalled: "Your current TaskMap is installed, so this version was not installed over it.",
  unknown: "Something went wrong.",
};

export function FailedScreen({
  failure,
  onRetry,
  onClose,
}: {
  failure: InstallFailure;
  onRetry(): void;
  onClose(): void;
}) {
  return (
    <div className="taskmap-installer__page">
      <h2>Installation didn't finish</h2>
      <p className="taskmap-installer__body" role="alert">
        {FAILURE_MESSAGES[failure]}
      </p>
      <footer className="taskmap-installer__actions">
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={onRetry} autoFocus>
          Try again
        </Button>
      </footer>
    </div>
  );
}
