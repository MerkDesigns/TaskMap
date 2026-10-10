// What the developer tools in tools/ share: terminal prompts and calls into the
// taskmap-dev-database binary, which reads and writes databases with the app's own Rust code.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const binary = join(
  resolve(dirname(fileURLToPath(import.meta.url))),
  "target/release/taskmap-dev-database.exe",
);

/** Runs `taskmap-dev-database <command>` with a JSON request; resolves with its JSON answer. */
export function runDevDatabase(command, request) {
  if (!existsSync(binary))
    return Promise.reject(
      new Error("taskmap-dev-database is not built; run the tool's npm script."),
    );
  return new Promise((resolveResult, reject) => {
    const child = spawn(binary, [command], { stdio: ["pipe", "pipe", "inherit"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", () => {
      try {
        resolveResult(JSON.parse(output.trim().split("\n").pop()));
      } catch {
        reject(new Error("taskmap-dev-database did not answer."));
      }
    });
    child.stdin.end(JSON.stringify(request));
  });
}

/** Reads a line without echoing it, for passwords. */
export async function askHidden(question) {
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

export async function ask(question, fallback = "") {
  const lines = createInterface({ input: stdin, output: stdout });
  try {
    return (await lines.question(question)).trim() || fallback;
  } finally {
    lines.close();
  }
}

/** A path typed or dragged into the terminal, which may arrive quoted. */
export const typedPath = (text) => resolve(text.trim().replace(/^"|"$/g, ""));
