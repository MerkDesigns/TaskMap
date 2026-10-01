import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { forwardRef, useEffect, useState, type InputHTMLAttributes } from "react";
import { TextField } from "../../ui/primitives/FormControls";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Hides the typed password again (e.g. after a submit cleared it). */
  readonly concealSignal: number;
}

/**
 * Password field with TaskMap's own reveal toggle (WebView2's built-in one is hidden in CSS: it
 * cannot be styled and only appears after real keystrokes). The icon shows the current state.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ concealSignal, disabled, ...props }, ref) {
    const [revealed, setRevealed] = useState(false);
    useEffect(() => setRevealed(false), [concealSignal]);
    const label = revealed ? "Hide password" : "Show password";
    return (
      <TextField
        {...props}
        ref={ref}
        disabled={disabled}
        type={revealed ? "text" : "password"}
        className="taskmap-database-entry__password"
        suffixSlot={
          <button
            type="button"
            className="taskmap-database-entry__reveal"
            aria-label={label}
            aria-pressed={revealed}
            title={label}
            disabled={disabled}
            // Like the native reveal button: not a Tab stop, so Tab moves field to field.
            tabIndex={-1}
            // Keep focus (and the caret) in the field while toggling.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <IconEye size={18} stroke={1.8} /> : <IconEyeOff size={18} stroke={1.8} />}
          </button>
        }
      />
    );
  },
);
