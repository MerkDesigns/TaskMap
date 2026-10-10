// Copies a TaskMap database with every text scrambled into random letters, so performance problems
// can be reproduced on its real shape without anyone reading its content.
//
//   npm run scramble-db
//
// Asks for the database, its password and a password for the copy, then writes
// `<name>-scrambled.tmapdb` next to it. The original is only read. Images are copied unchanged.
import { randomInt, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ask, askHidden, runDevDatabase, typedPath } from "../dev-database/client.mjs";

async function main() {
  const { scrambleDocument } = await import(
    new URL("../../dist-tools/scrambleDocument.mjs", import.meta.url).href
  );

  console.log("TaskMap database → scrambled copy\n");
  // Non-interactive runs (tests) pass everything through the environment.
  const env = process.env;
  const source = typedPath(env.TASKMAP_SCRAMBLE_SOURCE ?? (await ask("Database (.tmapdb): ")));
  if (!existsSync(source)) throw new Error(`${source} does not exist.`);
  const password = env.TASKMAP_SCRAMBLE_PASSWORD ?? (await askHidden("Its password: "));

  console.log("Unlocking (deriving the key takes a few seconds)…");
  const read = await runDevDatabase("read", { path: source, password });
  if (!read.ok) throw new Error(read.error);

  const databaseId = `database-${randomUUID()}`;
  const result = scrambleDocument(JSON.parse(read.document), {
    databaseId,
    randomInt: (below) => randomInt(below),
  });
  if (!result.ok) throw new Error(result.error);
  console.log("Scrambled:");
  for (const [key, count] of Object.entries(result.scrambledKeys))
    console.log(`  ${count} × ${key}`);

  const output = resolve(
    env.TASKMAP_SCRAMBLE_OUTPUT ??
      join(dirname(source), `${basename(source, extname(source))}-scrambled.tmapdb`),
  );
  if (existsSync(output)) throw new Error(`${output} already exists; move it away first.`);
  console.log(`\nThe copy will be ${output}`);
  const newPassword =
    env.TASKMAP_SCRAMBLE_NEW_PASSWORD ?? (await askHidden("Password for the copy: "));
  if (!env.TASKMAP_SCRAMBLE_NEW_PASSWORD && newPassword !== (await askHidden("Repeat it: ")))
    throw new Error("The passwords do not match.");

  console.log("\nWriting the copy…");
  const written = await runDevDatabase("write", {
    output,
    password: newPassword,
    databaseId,
    document: JSON.stringify(result.document),
    copyMediaFrom: source,
  });
  if (!written.ok) throw new Error(written.error);
  console.log(`Done: ${output} (${written.media} images).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}
