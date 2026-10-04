// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatCommandLine, parseCommandLine } from "./commandLine";

const invocations = (line: string) => {
  const parsed = parseCommandLine(line);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.invocations;
};

const error = (line: string) => {
  const parsed = parseCommandLine(line);
  if (parsed.ok) throw new Error(`expected "${line}" to be rejected`);
  return parsed.error;
};

describe("parseCommandLine", () => {
  it("splits a program and its arguments by Windows rules", () => {
    expect(invocations("npm run dev")).toEqual([
      { kind: "run", executable: "npm", arguments: ["run", "dev"] },
    ]);
    expect(invocations('"C:\\Program Files\\Tool\\tool.exe" --name "two words" ""')).toEqual([
      {
        kind: "run",
        executable: "C:\\Program Files\\Tool\\tool.exe",
        arguments: ["--name", "two words", ""],
      },
    ]);
    expect(invocations('echo-args "say \\"hi\\"" C:\\path\\')).toEqual([
      { kind: "run", executable: "echo-args", arguments: ['say "hi"', "C:\\path\\"] },
    ]);
  });

  it("runs commands joined by && one after another", () => {
    expect(invocations("docker desktop start && docker compose up -d")).toEqual([
      { kind: "run", executable: "docker", arguments: ["desktop", "start"] },
      { kind: "run", executable: "docker", arguments: ["compose", "up", "-d"] },
    ]);
    expect(invocations('tool "a && b"')).toEqual([
      { kind: "run", executable: "tool", arguments: ["a && b"] },
    ]);
  });

  it("turns start into opening a website, file or folder", () => {
    expect(invocations("start http://localhost:8081")).toEqual([
      { kind: "open", target: "http://localhost:8081" },
    ]);
    expect(invocations('start "" "C:\\My Folder"')).toEqual([
      { kind: "open", target: "C:\\My Folder" },
    ]);
    expect(invocations('start "C:\\My Folder"')).toEqual([
      { kind: "open", target: "C:\\My Folder" },
    ]);
    expect(error("start /b server.exe")).toContain("start options");
    expect(error("start")).toContain("start needs");
  });

  it("rejects shell features with an explanation", () => {
    expect(error("npm test | more")).toContain("Pipes");
    expect(error("npm test > out.txt")).toContain("Redirecting");
    expect(error("a & b")).toContain("single &");
    expect(error("echo %PATH%")).toContain("Environment variables");
    expect(error("cd C:\\Projects")).toContain("working directory");
    expect(error("del /q *")).toContain("cmd.exe /c del");
    expect(error('tool "unclosed')).toContain("not closed");
    expect(error("npm run dev &&")).toContain("both sides");
    expect(error("   ")).toBe("Enter a command.");
  });

  it("allows cmd.exe as an explicit program", () => {
    expect(invocations("cmd.exe /c echo hello")).toEqual([
      { kind: "run", executable: "cmd.exe", arguments: ["/c", "echo", "hello"] },
    ]);
  });
});

describe("formatCommandLine", () => {
  it("writes lines that parse back to the same invocations", () => {
    for (const line of [
      "npm run dev",
      "docker desktop start && docker compose up -d",
      "start http://localhost:8081",
      'start "C:\\My Folder"',
      '"C:\\Program Files\\Tool\\tool.exe" --name "two words" ""',
      'echo-args "say \\"hi\\"" "C:\\trailing space\\\\"',
      'tool "quoted \\" && still quoted" next',
    ]) {
      const parsed = invocations(line);
      expect(invocations(formatCommandLine(parsed))).toEqual(parsed);
    }
    expect(formatCommandLine(invocations("npm   run    dev"))).toBe("npm run dev");
  });
});
