// One-time migration of a TaskMap 0.3 export (.tmap) into a new TaskMap database (.tmapdb).
//
//   npm run migrate-legacy
//
// Asks for the export file, its password, which app will open the result and a new password,
// then writes the database next to the export. The export and the legacy app are only read.
import { spawn } from "node:child_process";
import { createDecipheriv, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const writer = join(
  repository,
  "tools/legacy-migrator/writer/target/release/taskmap-legacy-migrator-writer.exe",
);

// The legacy app's export format (src-tauri/src/portable.rs on main).
const EXPORT_VERSION = 1;
const EXPORT_KDF = "pbkdf2-sha256";
const EXPORT_KDF_ITERATIONS = 210_000;

/** Decrypts a legacy export; a wrong password fails the AES-GCM authentication. */
export function decryptLegacyExport(fileText, password) {
  let payload;
  try {
    payload = JSON.parse(fileText);
  } catch {
    throw new Error("This is not a TaskMap export file.");
  }
  if (
    payload?.version !== EXPORT_VERSION ||
    payload.kdf !== EXPORT_KDF ||
    payload.iterations !== EXPORT_KDF_ITERATIONS
  )
    throw new Error("This export file format is not supported.");
  const salt = Buffer.from(payload.salt, "base64");
  const nonce = Buffer.from(payload.nonce, "base64");
  const sealed = Buffer.from(payload.ciphertext, "base64");
  if (salt.length !== 16 || nonce.length !== 12 || sealed.length < 16)
    throw new Error("The export file is damaged.");
  const key = pbkdf2Sync(password, salt, EXPORT_KDF_ITERATIONS, 32, "sha256");
  // The Rust aes-gcm crate appends the 16-byte tag to the ciphertext.
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  try {
    const plaintext = Buffer.concat([
      decipher.update(sealed.subarray(0, sealed.length - 16)),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    throw new Error("Wrong export password (or the file is damaged).");
  } finally {
    key.fill(0);
  }
}

/** Reads a line without echoing it, for passwords. */
async function askHidden(question) {
  stdout.write(question);
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolveAnswer, reject) => {
    let answer = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.off("data", onData);
          stdin.setRawMode?.(false);
          stdin.pause();
          stdout.write("\n");
          resolveAnswer(answer);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode?.(false);
          reject(new Error("Cancelled."));
          return;
        }
        if (char === "\u0008" || char === "\u007f") answer = answer.slice(0, -1);
        else answer += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function ask(question, fallback = "") {
  const lines = createInterface({ input: stdin, output: stdout });
  try {
    return (await lines.question(question)).trim() || fallback;
  } finally {
    lines.close();
  }
}

function writeDatabase(request) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(writer, [], { stdio: ["pipe", "pipe", "inherit"] });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", () => {
      try {
        resolveResult(JSON.parse(output.trim().split("\n").pop()));
      } catch {
        reject(new Error("The database writer did not answer."));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

async function main() {
  if (!existsSync(writer))
    throw new Error("The writer is not built; run `npm run migrate-legacy`.");
  const { convertLegacyExport } = await import(
    new URL("../../dist-migrator/convertLegacyExport.mjs", import.meta.url).href
  );

  console.log("TaskMap 0.3 → TaskMap database migration\n");
  // Non-interactive runs (tests) pass everything through the environment.
  const env = process.env;
  const exportPath = resolve(
    (env.TASKMAP_MIGRATE_EXPORT ?? (await ask("Export file (.tmap): "))).replace(/^"|"$/g, ""),
  );
  if (!existsSync(exportPath)) throw new Error(`${exportPath} does not exist.`);
  const exportPassword =
    env.TASKMAP_MIGRATE_EXPORT_PASSWORD ?? (await askHidden("Export password: "));
  const body = decryptLegacyExport(readFileSync(exportPath, "utf8"), exportPassword);
  console.log("Export decrypted.\n");

  const app = (
    env.TASKMAP_MIGRATE_APP ?? (await ask("Open it in TaskMap Beta or stable? [beta]: ", "beta"))
  ).toLowerCase();
  if (app !== "beta" && app !== "stable") throw new Error('Answer "beta" or "stable".');
  const databaseId = `database-${randomUUID()}`;
  const result = convertLegacyExport(body, {
    databaseId,
    databasePurpose: app === "stable" ? "production" : "development",
    ids: { nextUuid: () => randomUUID() },
    randomBytes: (length) => randomBytes(length),
  });
  if (!result.ok) throw new Error(result.error);

  console.log("Converted:");
  for (const [what, count] of Object.entries(result.report.counts))
    console.log(`  ${count} ${what}`);
  if (result.report.notes.length > 0) {
    console.log("\nNotes:");
    for (const note of result.report.notes) console.log(`  - ${note}`);
  }

  const output = resolve(
    env.TASKMAP_MIGRATE_OUTPUT ??
      join(dirname(exportPath), `${basename(exportPath, extname(exportPath))}.tmapdb`),
  );
  if (existsSync(output)) throw new Error(`${output} already exists; move it away first.`);
  console.log(`\nThe new database will be ${output}`);
  const password = env.TASKMAP_MIGRATE_NEW_PASSWORD ?? (await askHidden("New database password: "));
  if (!env.TASKMAP_MIGRATE_NEW_PASSWORD && password !== (await askHidden("Repeat it: ")))
    throw new Error("The passwords do not match.");

  console.log("\nWriting the database (deriving the key takes a few seconds)…");
  const written = await writeDatabase({
    output,
    password,
    databaseId,
    document: JSON.stringify(result.document),
    media: result.media,
  });
  if (!written.ok) throw new Error(written.error);
  console.log(
    `Done: ${output} (${written.media} images). Open it in TaskMap ${app === "stable" ? "" : "Beta "}with the new password.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}
