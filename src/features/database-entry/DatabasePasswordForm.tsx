import { useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "../../ui/primitives/Field";
import { TextField } from "../../ui/primitives/FormControls";
import { Button } from "../../ui/primitives/Button";

export function DatabasePasswordForm({
  creating,
  busy,
  onSubmit,
  onBack,
}: {
  readonly creating: boolean;
  readonly busy: boolean;
  readonly onSubmit: (password: string) => Promise<void>;
  readonly onBack: () => void;
}) {
  const password = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!busy) password.current?.focus();
  }, [busy]);
  useEffect(() => {
    password.current?.focus();
    const input = password.current,
      repeated = confirmation.current;
    return () => {
      if (input) input.value = "";
      if (repeated) repeated.value = "";
    };
  }, [creating]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const value = password.current?.value ?? "";
    const matches = !creating || value === confirmation.current?.value;
    if (password.current) password.current.value = "";
    if (confirmation.current) confirmation.current.value = "";
    if (!value || new TextEncoder().encode(value).length > 1024 || !matches) {
      setError(
        !matches ? "The passwords do not match." : "Enter a password of 1–1024 UTF-8 bytes.",
      );
      password.current?.focus();
      return;
    }
    setError(null);
    void onSubmit(value);
  };
  return (
    <form onSubmit={submit} className="taskmap-database-entry__form" aria-busy={busy}>
      <Field label="Password" error={error} required>
        <TextField
          ref={password}
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          disabled={busy}
          spellCheck={false}
          autoCapitalize="none"
        />
      </Field>
      {creating ? (
        <Field label="Confirm password" required>
          <TextField
            ref={confirmation}
            type="password"
            autoComplete="new-password"
            disabled={busy}
            spellCheck={false}
          />
        </Field>
      ) : null}
      {creating ? (
        <p className="taskmap-database-entry__hint">
          Keep this password safe. TaskMap cannot recover it for you.
        </p>
      ) : null}
      <div className="taskmap-database-entry__actions">
        <Button onClick={onBack} disabled={busy} tabIndex={0}>
          Back
        </Button>
        <Button type="submit" variant="primary" disabled={busy} tabIndex={0}>
          {busy ? "Please wait…" : creating ? "Create database" : "Unlock"}
        </Button>
      </div>
    </form>
  );
}
