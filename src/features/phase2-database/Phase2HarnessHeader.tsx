interface Phase2HarnessHeaderProps {
  readonly onDismiss: () => void;
}

export function Phase2HarnessHeader({ onDismiss }: Phase2HarnessHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">Phase 2 encrypted database harness</h2>
        <p className="mt-1 text-sm text-white/58">
          Development-only. Media bytes are intentionally not encrypted.
        </p>
      </div>
      <button type="button" onClick={onDismiss}>
        Close panel
      </button>
    </div>
  );
}
