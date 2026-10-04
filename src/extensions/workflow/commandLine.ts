import type { WorkflowInvocation } from "./workflowDefinition";

export type CommandLineParse =
  | { readonly ok: true; readonly invocations: readonly WorkflowInvocation[] }
  | { readonly ok: false; readonly error: string };

interface Word {
  readonly text: string;
  readonly quoted: boolean;
}

/** cmd.exe built-ins: they are not programs, so they cannot run without a shell. */
const SHELL_BUILT_INS = new Set([
  "assoc",
  "break",
  "call",
  "cd",
  "chdir",
  "cls",
  "color",
  "copy",
  "date",
  "del",
  "dir",
  "echo",
  "endlocal",
  "erase",
  "exit",
  "for",
  "ftype",
  "goto",
  "if",
  "md",
  "mkdir",
  "mklink",
  "move",
  "path",
  "pause",
  "popd",
  "prompt",
  "pushd",
  "rd",
  "rem",
  "ren",
  "rename",
  "rmdir",
  "set",
  "setlocal",
  "shift",
  "time",
  "title",
  "type",
  "ver",
  "verify",
  "vol",
]);

const fail = (error: string): CommandLineParse => ({ ok: false, error });

/**
 * Splits one segment into words by Windows argument rules: whitespace separates, double quotes
 * group, and backslashes escape a following quote (2n backslashes and a quote give n backslashes
 * and a quote toggle; 2n + 1 give n backslashes and a literal quote).
 */
function splitWords(segment: string): Word[] {
  const words: Word[] = [];
  let text = "";
  let quoted = false;
  let inQuotes = false;
  let started = false;
  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index];
    if (char === "\\") {
      let backslashes = 0;
      while (segment[index] === "\\") {
        backslashes += 1;
        index += 1;
      }
      if (segment[index] === '"') {
        text += "\\".repeat(Math.floor(backslashes / 2));
        if (backslashes % 2 === 1) text += '"';
        else {
          inQuotes = !inQuotes;
          quoted = true;
        }
      } else {
        text += "\\".repeat(backslashes);
        index -= 1;
      }
      started = true;
    } else if (char === '"') {
      if (inQuotes && segment[index + 1] === '"') {
        text += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
        quoted = true;
      }
      started = true;
    } else if (!inQuotes && /\s/.test(char)) {
      if (started) words.push({ text, quoted });
      text = "";
      quoted = false;
      started = false;
    } else {
      text += char;
      started = true;
    }
  }
  if (started) words.push({ text, quoted });
  return words;
}

/** Splits at `&&` outside quotes; rejects shell operators that have no structured meaning. */
function splitSegments(line: string): string[] | string {
  const segments: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      // As in splitWords, a quote after an odd number of backslashes is literal.
      let backslashes = 0;
      while (line[index - 1 - backslashes] === "\\") backslashes += 1;
      if (backslashes % 2 === 0) inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if (char === "&" && line[index + 1] === "&") {
        segments.push(current);
        current = "";
        index += 1;
        continue;
      }
      if (char === "|")
        return "Pipes (|) are a shell feature. Put each program on its own line or use && instead.";
      if (char === "&")
        return "A single & is a shell feature. Use && to run one program after another.";
      if (char === "<" || char === ">")
        return "Redirecting output (< or >) is a shell feature and is not supported.";
      if (char === "^") return "The ^ escape character is a shell feature and is not supported.";
    }
    current += char;
  }
  if (inQuotes) return "A quote is not closed.";
  segments.push(current);
  return segments;
}

function invocationOf(words: Word[]): WorkflowInvocation | string {
  const [program, ...rest] = words;
  const name = program.text.toLowerCase();
  if (name === "start") {
    // As in cmd.exe, a quoted first word followed by more is the window title.
    const words = rest.length > 1 && rest[0].quoted ? rest.slice(1) : rest;
    if (words.some((word) => !word.quoted && word.text.startsWith("/")))
      return "start options such as /b are not supported.";
    if (words.length !== 1) return "start needs exactly one website, file or folder to open.";
    if (!words[0].text.trim()) return "start needs a website, file or folder to open.";
    return { kind: "open", target: words[0].text };
  }
  if (!program.quoted && SHELL_BUILT_INS.has(name)) {
    return name === "cd" || name === "chdir"
      ? "cd is a shell command. Put the folder in the working directory instead."
      : `${program.text} is a cmd.exe command, not a program. Run it as: cmd.exe /c ${program.text} ...`;
  }
  if (!program.text.trim()) return "A command needs a program to run.";
  return { kind: "run", executable: program.text, arguments: rest.map((word) => word.text) };
}

/**
 * Parses a command line as the Command Runner accepted it, without ever handing it to a shell:
 * `a && b` runs b after a succeeds, `start <target>` opens a website, file or folder with its
 * default app, and everything else becomes a program and its arguments.
 */
export function parseCommandLine(line: string): CommandLineParse {
  if (!line.trim()) return fail("Enter a command.");
  if (/%[^%\s]+%/.test(line))
    return fail("Environment variables (%NAME%) are a shell feature. Type the value instead.");
  const segments = splitSegments(line);
  if (typeof segments === "string") return fail(segments);
  const invocations: WorkflowInvocation[] = [];
  for (const segment of segments) {
    const words = splitWords(segment);
    if (words.length === 0) return fail("&& needs a command on both sides.");
    const invocation = invocationOf(words);
    if (typeof invocation === "string") return fail(invocation);
    invocations.push(invocation);
  }
  return { ok: true, invocations };
}

/** Quotes a word so that splitWords reads it back unchanged. */
function quote(word: string): string {
  if (word && !/[\s"]/.test(word)) return word;
  let quoted = '"';
  let backslashes = 0;
  for (const char of word) {
    if (char === "\\") {
      backslashes += 1;
      continue;
    }
    if (char === '"') quoted += "\\".repeat(backslashes * 2 + 1) + '"';
    else quoted += "\\".repeat(backslashes) + char;
    backslashes = 0;
  }
  return `${quoted}${"\\".repeat(backslashes * 2)}"`;
}

/** Shows a line's invocations as the command line that parses back to them. */
export function formatCommandLine(invocations: readonly WorkflowInvocation[]): string {
  return invocations
    .map((invocation) =>
      invocation.kind === "open"
        ? `start ${quote(invocation.target)}`
        : [invocation.executable, ...invocation.arguments].map(quote).join(" "),
    )
    .join(" && ");
}
