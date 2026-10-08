# Legacy migrator

Turns a TaskMap 0.3 export (`.tmap`) into a new TaskMap database (`.tmapdb`). One-time use; see
ADR 010.

1. In the old TaskMap, export your data to a `.tmap` file with a password.
2. In this repository, run:

   ```bash
   npm run migrate-legacy
   ```

3. Answer the prompts: the export file (dragging it into the terminal works), its password, which
   app will open the result (`beta` for TaskMap Beta), and a new password for the database.
4. Read the report: it lists anything that could not come across unchanged.
5. Open the new `.tmapdb` (written next to the export) in TaskMap Beta with the new password.

The export and the old app are only read. The tool refuses to overwrite an existing file.

| Part                     | Role                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `migrate.mjs`            | prompts, decrypts the export, runs the conversion and the writer   |
| `convertLegacyExport.ts` | legacy data → document, checked with the app's validation          |
| `legacyExportSchema.ts`  | the legacy data shape                                              |
| `legacyExtensions.ts`    | extensions, incl. Command Runner commands → workflow lines         |
| `legacyMedia.ts`         | bundled images → media                                             |
| `writer/`                | Rust: creates the encrypted database with the app's own crate code |
