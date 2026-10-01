import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Field } from "../../ui/primitives/Field";
import { IconArrowBigUpLine } from "@tabler/icons-react";
import { Button } from "../../ui/primitives/Button";
import { PasswordInput } from "./PasswordInput";
import { useCapsLock } from "./useCapsLock";

export function DatabasePasswordForm({
  creating,
  busy,
  dimmed,
  path,
  onSubmit,
  onBack,
  onCreateInstead,
}: {
  readonly creating: boolean;
  /** Blocks submission; controls only look disabled once work is slow (`dimmed`). */
  readonly busy: boolean;
  readonly dimmed: boolean;
  readonly path: string | null;
  readonly onSubmit: (password: string) => Promise<void>;
  /** Creating: back to the recent list. Unlocking: release this database and choose another. */
  readonly onBack: () => void;
  readonly onCreateInstead: () => void;
}) {
  const password = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [concealSignal, setConcealSignal] = useState(0);
  const capsLock = useCapsLock();
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
  // Native Tab traversal is off app-wide; creating keeps Tab between its two password fields.
  const switchField = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Tab" || !creating) return;
    const next =
      event.target === password.current
        ? confirmation.current
        : event.target === confirmation.current
          ? password.current
          : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const value = password.current?.value ?? "";
    const matches = !creating || value === confirmation.current?.value;
    if (password.current) password.current.value = "";
    if (confirmation.current) confirmation.current.value = "";
    setConcealSignal((signal) => signal + 1);
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
    <form
      onSubmit={submit}
      onKeyDown={switchField}
      className="taskmap-database-entry__form"
      data-database-entry-form={creating ? "create" : "unlock"}
      aria-busy={busy}
    >
      <Field label="Password" error={error} required>
        <PasswordInput
          ref={password}
          concealSignal={concealSignal}
          autoComplete="off"
          disabled={dimmed}
          spellCheck={false}
          autoCapitalize="none"
        />
      </Field>
      {creating ? (
        <Field label="Confirm password" required>
          <PasswordInput
            ref={confirmation}
            concealSignal={concealSignal}
            autoComplete="off"
            disabled={dimmed}
            spellCheck={false}
          />
        </Field>
      ) : null}
      {/* Path and Caps Lock share one line, so the warning never shifts the layout. */}
      <div className="taskmap-database-entry__field-meta">
        <span className="taskmap-database-entry__path">{path}</span>
        {capsLock ? (
          <span role="status" className="taskmap-database-entry__caps-lock">
            <IconArrowBigUpLine size={13} stroke={2} aria-hidden="true" />
            Caps Lock is on
          </span>
        ) : null}
      </div>
      {creating ? (
        <>
          <p className="taskmap-database-entry__hint">
            Keep this password safe. TaskMap cannot recover it for you.
          </p>
          <p className="taskmap-database-entry__privacy">
            Canvas content is encrypted. Images and GIFs are not encrypted and can be extracted from
            the database file.
          </p>
        </>
      ) : null}
      <div className="taskmap-database-entry__actions">
        {creating ? (
          <Button onClick={onBack} disabled={dimmed} tabIndex={0}>
            Back
          </Button>
        ) : (
          <>
            <Button onClick={onCreateInstead} disabled={dimmed} tabIndex={0}>
              New database
            </Button>
            <Button onClick={onBack} disabled={dimmed} tabIndex={0}>
              Change database
            </Button>
          </>
        )}
        <Button
          type="submit"
          variant="primary"
          className="taskmap-database-entry__submit"
          disabled={dimmed}
          tabIndex={0}
        >
          {creating ? "Create database" : "Unlock"}
        </Button>
      </div>
    </form>
  );
}
