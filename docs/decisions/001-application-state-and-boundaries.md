# ADR 001: Application state and platform boundaries

- Status: Accepted
- Date: 2026-08-06

## Context

TaskMap must replace its legacy internal architecture without changing retained behavior during the transition. The target needs predictable persistent state, domain transactions, a responsive pointer path, and a narrow boundary around Tauri and future Rust services. Phase 1 establishes those seams while the legacy application remains the active implementation.

## Decision

Redux Toolkit is the application state foundation. It provides a conventional store, typed React integration, immutable reducer ergonomics through Immer, and a suitable middleware path for later command history and persistence coordination. `react-redux` supplies the provider and typed hooks. Immer is also declared directly because planned history contracts use its public `Patch` type, which Redux Toolkit does not re-export.

High-frequency interaction state will remain outside Redux. Pointer samples, drag and resize previews, selection rectangles, snap guides, and other per-frame state belong to a dedicated interaction subsystem. That subsystem will publish transient previews and dispatch one named domain command when an interaction completes, avoiding Redux updates, serialization, persistence, or history entries on pointer frames.

The current `App.tsx` remains active behind `LegacyApplication`. `AppShell` only composes `AppProviders` and that temporary adapter. This preserves the legacy DOM and feature behavior while creating the final entrypoint and provider boundary; feature logic will move only through later parity-tested vertical slices.

TypeScript owns the decrypted current-version document schema and domain invariants. The application needs those types directly for commands, selectors, element modules, extension modules, and history. Later Rust storage code will validate the database and encryption envelope while treating the encrypted document payload as opaque bytes, avoiding a second domain schema with divergent rules.

Typed platform interfaces are introduced before backend implementation. Application and feature code can depend on narrow database, media, settings, and workflow capabilities without importing Tauri or binding to legacy storage. Concrete adapters can be injected later and tested independently. Phase 1 intentionally provides no adapter and does not route these interfaces to the old backend.

## Consequences

- The Redux store initially contains only shell-level state; document state and history arrive in later phases.
- Transient interaction state cannot be placed in Redux merely for convenience.
- New frontend Tauri imports are restricted to `src/platform/`; the architecture checker explicitly allow-lists existing legacy imports until their owning features are ported.
- The architecture element and extension registries are explicit and initially empty, so importing them has no registration side effects.
- `FrostedSurface` is available for later ports but does not replace legacy surfaces during Phase 1.
