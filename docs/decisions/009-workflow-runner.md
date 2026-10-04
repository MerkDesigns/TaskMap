# ADR 009: Structured Workflow Runner as a text-card extension with per-device trust

- Status: Accepted
- Date: 2026-10-04

## Context

The legacy Command Runner was a text-card extension that ran a list of raw `cmd.exe` strings, each
in a visible console or hidden, optionally elevated. Its purpose (starting development tools from a
card) is kept; its mechanism is removed by contract: no raw shell strings, no administrator
elevation, imported definitions disabled until trusted, and only TaskMap-launched processes stoppable
(`FEATURE-PARITY.md`, `SECURITY.md`, `ARCHITECTURE.md`).

## Decision

**Placement.** The Workflow Runner is a text-card extension (`workflow`), like the Command Runner.
A card with the extension shows run/stop controls; its menu opens the workflow editor. It follows the
extension contribution points of ADR 008.

**Definition.** The workflow is the extension's configuration, stored in the encrypted document:
an ordered list of steps, each `{ executable, arguments[], workingDirectory | null, display,
waitForExit }`. `display` is `terminal` (a visible console window) or `background` (no window,
tracked). Steps start in order; a step with `waitForExit` holds the next step until it exits, and
one without it lets the next step start at once. With every flag off all steps start together, as
the Command Runner's commands did (a frontend and a backend server both keep running); a run of
waiting steps is a sequence. There is no shell string field. Explicit named sequence and parallel
groups can be added later as an additive schema change.

**Launch.** Rust owns process launching and tracking (`ARCHITECTURE.md`: Rust services own native
operations). A step starts its executable directly with its argument list, never through a shell;
batch files run through the platform's argument-escaping launcher, which rejects arguments it cannot
quote safely. Nothing requests elevation. Every launched process is assigned to a TaskMap-owned job,
so stopping a run ends that process tree and nothing else. As with the Command Runner, quitting
TaskMap leaves running processes running (a development server outlives the window) and only drops
TaskMap's tracking of them. Locking the database stops no process, but starting, stopping or querying
runs requires the unlocked session of the database that owns them.

**Trust.** Trust is per device and outside the document. The device records trusted definitions as
`(database id, SHA-256 of the canonical definition)`. Rust checks the record before launching; a
definition that is not recorded does not run. The editor records trust when the user saves a
workflow, since the user wrote it. Any other definition (pasted from another card, written by AI
JSON, opened from a database used on another device, or changed outside the editor) starts disabled:
the card offers a review that shows every step's executable, arguments and working directory, and
trusting from that review records it. A document can therefore never mark its own workflows trusted.

**Privacy.** Logs never contain workflow definitions or process output; run status carries only
run ids, step indexes, exit codes and timing.

## Consequences

- A document copied to another device, or edited by anything but the editor, needs a review before
  its workflows run again. Trusting is cheap and explicit.
- Changing any field of a step changes the hash, so an edit from outside the editor cannot keep a
  previous trust.
- Named groups, keeping a terminal open after exit, and output capture are later additions; the
  schema is versioned through the extension configuration.
