# Prepared glass benchmark files

2026-09-06 — User selected **prepare benchmark files only**. No TaskMap import, application launch,
database write, keyring access, release trace, or production source change in this preparation pass.
This advances acceptance part 1, but does not close it or start part 2.

## What is prepared

Local output: `fixtures/glass-normal-v1/` (ignored by Git).

- `document.json`: active legacy schema v2, 25 canvases, 2,000 elements (80 per canvas).
  Each canvas contains 20 containers, 20 text cards, 20 text blocks, 20 images, and one mind-map
  connection. This is **not** 2,000 elements on the active canvas. Distribution is explicit so future
  results cannot be compared to the old single-canvas fixture without accounting for workload.
- `media/`: 450 lossless WebP stills (768 × 512) and 50 looping GIFs (256 × 256, 12 changing frames,
  80ms per frame). Total **582,508,631 bytes**, exceeding the 500,000,000-byte minimum without padding.
- Search, checkbox, privacy, lock and color extensions are represented. Privacy/lock are installed
  but inactive so the fixture is usable for drag/resize. No commands or executable workflows.
- `manifest.json`: every media hash, format, size, dimensions, frame count and relative path;
  document checksum, producer versions, seed and explicit false import/performance-acceptance flags.

The assets are seeded synthetic high-entropy imagery, not user files or downloaded photos. They are
useful for repeatable media/decode/compositing workload, not a substitute for natural-image/GIF visual
parity checks. Generated source bytes are already in supported stored-media formats, but the actual
Rust import/restore path has **not** been exercised with this fixture.

`fixtures/glass-smoke-v1/` is a separate tiny test: two canvases, 16 elements, four assets, 28,884 bytes.
It is never the normal acceptance fixture. Existing `fixtures:baseline` behavior is unchanged.

## Reproduction

Generator: `scripts/generate-glass-benchmark.py`. Recorded toolchain: Python 3.12.14,
Pillow 12.3.0, libwebp 1.6.0, seed 604506. Pin these for byte-for-byte reproduction; codec versions
can change output bytes. The generator prints bounded progress and refuses any existing output
directory, including partial runs. It never deletes an old fixture or writes a completion manifest
for an undersized corpus. Allow about 600 MB of free space for full output.

From the repository root with that Python/Pillow environment:

```powershell
python scripts/generate-glass-benchmark.py --smoke
python scripts/generate-glass-benchmark.py
python scripts/generate-glass-benchmark.py --verify
python scripts/test_glass_benchmark.py
npm test -- scripts/glass-benchmark.test.mjs
```

On this workstation the verified bundled Python executable is:
`C:\Users\Merk\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`.
Use PowerShell's `&` operator with the quoted executable path in place of `python` if needed.
Do not regenerate into the existing directories; `--verify` is read-only and can be repeated.

The offline verifier hashes and decodes all 500 assets and all 1,050 frames, checks metadata, unique
hashes, the byte budget, document checksum, exact layout and media references. Six generator tests
exercise determinism, changing GIF frames/timing, layout, overwrite protection, corruption detection
and incomplete-corpus rejection. Four generated-artifact tests pass against the actual TypeScript
production schema (normal and smoke); they intentionally skip when fixtures have not been generated.
Check that the targeted invocation reports **four passed, zero skipped**.

Full fixture checksums:

- Document SHA-256: `832619425cc065917e6f07f5da376870ae8ded57503d2b93f49e9fcf1cdfbf28`
- Manifest SHA-256: `57a53763dcd2a3a9d33c5d41b3d43249c1c4fafd9c0ed6c2c53fdb72c5c1b5c2`

## Why these are not a portable import

The active legacy storage in `src-tauri/src/storage.rs` still uses a constant keyring service/user
(`TaskMap` / `app-data-key`). App identifiers separate database locations, but not that legacy key.
Do not infer isolation from stable versus dev names, copy a user database, reset a key, or import
these files into the current profile. The Phase 2 database backend is not the active production UX.

`src-tauri/src/portable.rs` also caps portable payloads at 512 MiB. Bundled media is base64-encoded
inside encrypted JSON, whose ciphertext is base64-encoded again: 500 MB of media alone becomes
roughly 889 MB before metadata. A monolithic `.tmap` cannot carry the normative media budget under
that limit. Raw `document.json` is not an importable portable file. No limit was raised and no
TypeScript/Python encryption or direct database writer was added.

## Next, only when an isolated environment is available

1. Use a separate Windows account or VM with fresh benchmark-only storage/keyring. Confirm isolation
   before any loading. Keep the MCP bridge debug-only; do not add it to release for convenience.
2. Establish a bounded **Rust-owned** fixture loading path in that isolated environment, respecting
   existing per-image validation and avoiding the monolithic portable limit. Verify all 500 images
   resolve, bytes remain out of document state, and installed byte counts match the manifest. Loading
   tooling is not implemented by this files-only pass; do not hand-edit or bypass encrypted storage.
3. Package and identify the release; record exact Windows/WebView runtime, DPI, refresh rate, viewport,
   foreground state and scene. Capture presented frames externally for pan/zoom/drag/resize, with
   closed chrome, Canvas Browser, and Browser + Quick Extensions. Attribute controller, React,
   material, browser and persistence costs separately. No rendered-frame capture is supplied here.
4. Apply `docs/TESTING.md`'s release criteria and then proceed to broader visual acceptance.

No new live-app visual verification was performed in this files-only pass. The Tauri bridge was not
connected; the application was left alone per the user's direction. Prior development diagnostics
remain in `docs/GLASS-PERFORMANCE-ACCEPTANCE.md` and are not release FPS evidence.
