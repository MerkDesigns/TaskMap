// Legacy element extensions as extension installations. Most keep their settings unchanged; the
// Command Runner becomes a workflow, and extensions of removed features are reported.
import { z } from "zod";
import type { ExtensionInstallation, JsonObject } from "../../src/domain/document/documentTypes";
import { getArchitectureExtensionDefinitions } from "../../src/extensions/architectureRegistry";
import { parseCommandLine } from "../../src/extensions/workflow/commandLine";

export interface ConversionLog {
  /** Something that could not come across unchanged, for the person migrating to read. */
  readonly note: (text: string) => void;
  readonly count: (what: string) => void;
}

// Legacy-only extensions of features the new app removed.
const REMOVED_EXTENSIONS: Readonly<Record<string, string>> = {
  dailyReset: "daily reset",
  pickCard: "pick-a-card",
  sorting: "sorting",
};

const legacyCommandsSchema = z.object({
  commands: z.array(
    z.object({
      command: z.string(),
      workingDirectory: z.string().optional(),
      runMode: z.enum(["terminal", "background"]).catch("terminal"),
      runAsAdmin: z.boolean().optional(),
    }),
  ),
});

/** The Command Runner's saved commands as workflow lines; ones a workflow cannot run are noted. */
function workflowFromCommands(value: unknown, name: string, log: ConversionLog): unknown {
  const parsed = legacyCommandsSchema.safeParse(value);
  if (!parsed.success) return value;
  const lines = [];
  for (const command of parsed.data.commands) {
    const line = parseCommandLine(command.command);
    if (!line.ok) {
      log.note(
        `${name}: the command \`${command.command}\` cannot run as a workflow (${line.error}) and was left out.`,
      );
      continue;
    }
    if (command.runAsAdmin)
      log.note(`${name}: \`${command.command}\` ran as administrator before; workflows never do.`);
    lines.push({
      invocations: line.invocations,
      workingDirectory: command.workingDirectory?.trim() || null,
      display: command.runMode,
    });
  }
  log.count("workflows");
  return { lines };
}

export interface LegacyExtensionTarget {
  readonly elementId: string;
  /** The element's new type, which decides which extensions apply. */
  readonly type: string;
  /** How the element is named in notes. */
  readonly name: string;
}

/** The installations for one element's legacy `extensions` object. */
export function convertLegacyExtensions(
  extensions: Readonly<Record<string, unknown>> | undefined,
  target: LegacyExtensionTarget,
  newInstallationId: () => string,
  log: ConversionLog,
): ExtensionInstallation[] {
  const definitions = getArchitectureExtensionDefinitions();
  const installations: ExtensionInstallation[] = [];
  for (const [key, value] of Object.entries(extensions ?? {})) {
    if (value === undefined || value === null) continue;
    if (key in REMOVED_EXTENSIONS) {
      log.note(
        `${target.name}: the ${REMOVED_EXTENSIONS[key]} extension no longer exists and was left out.`,
      );
      continue;
    }
    const viewKey = key === "commandRunner" ? "workflow" : key;
    const definition = definitions.find((candidate) => candidate.viewKey === viewKey);
    if (!definition) {
      log.note(`${target.name}: the unknown extension "${key}" was left out.`);
      continue;
    }
    if (!definition.compatibleElementTypes.includes(target.type)) {
      log.note(
        `${target.name}: ${definition.catalog.title} does not apply to this element and was left out.`,
      );
      continue;
    }
    const configuration =
      key === "commandRunner" ? workflowFromCommands(value, target.name, log) : value;
    const parsed = definition.parseConfiguration(configuration);
    if (!parsed.ok) {
      log.note(
        `${target.name}: its ${definition.catalog.title} settings were unreadable and were left out.`,
      );
      continue;
    }
    installations.push({
      id: newInstallationId(),
      extensionId: definition.id,
      target: { kind: "element", elementId: target.elementId },
      enabled: true,
      configuration: parsed.configuration as JsonObject,
    } as ExtensionInstallation);
    log.count("extensions");
  }
  return installations;
}
