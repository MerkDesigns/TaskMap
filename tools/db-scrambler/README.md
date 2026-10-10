# Database scrambler

Copies a TaskMap database with every text replaced by random letters, so a performance problem can
be reproduced on the database's real shape without reading its content.

```bash
npm run scramble-db
```

Answer the prompts: the database (dragging it into the terminal works), its password and a password
for the copy. The copy is written next to it as `<name>-scrambled.tmapdb`; the original is only read
and may stay open in TaskMap.

What changes and what stays:

- Every letter becomes a random letter of the same case and every digit a random digit: card and
  block text, names, canvas names, links, search queries, workflow commands and folders. Spaces,
  line breaks, punctuation and emoji stay, so text measures and wraps like the original.
- Layout, layers, colours, extensions, connections and settings stay as they are.
- Images and GIFs are copied unchanged.

Only strings under known structural keys (ids, types, colours, enums) are kept; anything else is
scrambled, so a new field cannot leak. The result is checked with the app's own validation, and the
tool prints how many strings it scrambled under each key.

| Part                  | Role                                                 |
| --------------------- | ---------------------------------------------------- |
| `scramble.mjs`        | prompts, reads the database, writes the copy         |
| `scrambleDocument.ts` | the scrambling, checked with the app's validation    |
| `../dev-database/`    | Rust: reads and writes databases with the app's code |
