import { IconArrowBackUp, IconArrowForwardUp, IconMenu2, IconPuzzle, IconSettings } from "@tabler/icons-react";

type FloatingToolbarProps = {
  canRedo: boolean;
  canUndo: boolean;
  canvasesOpen: boolean;
  extensionsOpen: boolean;
  onRedo: () => void;
  onToggleExtensions: () => void;
  onToggleCanvases: () => void;
  onUndo: () => void;
  onOpenSettings: () => void;
};

export function FloatingToolbar({
  canRedo,
  canUndo,
  canvasesOpen,
  extensionsOpen,
  onRedo,
  onToggleExtensions,
  onToggleCanvases,
  onUndo,
  onOpenSettings,
}: FloatingToolbarProps) {
  const buttonClass = (active = false) =>
    `grid h-7 w-7 place-items-center rounded-md transition-colors disabled:cursor-default disabled:text-white/25 disabled:hover:bg-transparent ${
      active
        ? "bg-white/[0.14] text-white"
        : "text-white/70 hover:bg-white/[0.10] hover:text-white"
    }`;

  return (
    <div className="fixed left-4 top-4 z-20 flex items-center gap-2">
      <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.15] bg-[#1b1b1e]/88 px-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.38)] backdrop-blur-md">
      <button
        className={buttonClass(canvasesOpen)}
        onClick={onToggleCanvases}
        title="Canvases"
      >
        <IconMenu2 size={18} stroke={2} />
      </button>
      <button
        className={buttonClass(extensionsOpen)}
        onClick={onToggleExtensions}
        title="Extensions"
      >
        <IconPuzzle size={18} stroke={2} />
      </button>
      <button
        className={buttonClass()}
        onClick={onOpenSettings}
        title="Settings"
      >
        <IconSettings size={18} stroke={2} />
      </button>
      </div>
      <div className="flex h-10 items-center gap-1 rounded-xl border border-white/[0.15] bg-[#1b1b1e]/88 px-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.38)] backdrop-blur-md">
      <button className={buttonClass()} onClick={onUndo} disabled={!canUndo} title="Undo">
        <IconArrowBackUp size={18} stroke={2} />
      </button>
      <button className={buttonClass()} onClick={onRedo} disabled={!canRedo} title="Redo">
        <IconArrowForwardUp size={18} stroke={2} />
      </button>
      </div>
    </div>
  );
}
