import type { ExtensionInstallation, TaskMapDocument } from "../documentTypes";
import type { DocumentInvariantIssue } from "../documentInvariants";

export function inspectExtensionInvariants(
  document: TaskMapDocument,
): readonly DocumentInvariantIssue[] {
  const issues: DocumentInvariantIssue[] = [];
  const installations = new Set<string>();
  for (const installation of Object.values(document.extensionInstallations)) {
    const targetKey = getTargetKey(installation);
    const installationKey = `${installation.extensionId}:${targetKey}`;
    if (installations.has(installationKey)) {
      issues.push({
        code: "extension-installation-duplicate",
        path: `extensionInstallations.${installation.id}`,
        message: `Extension ${installation.extensionId} is installed twice on ${targetKey}`,
      });
    }
    installations.add(installationKey);
    inspectTarget(document, installation, issues);
  }
  return issues;
}

function inspectTarget(
  document: TaskMapDocument,
  installation: ExtensionInstallation,
  issues: DocumentInvariantIssue[],
) {
  const target = installation.target;
  const exists =
    target.kind === "document"
      ? target.documentId === document.id
      : target.kind === "canvas"
        ? document.canvases[target.canvasId] !== undefined
        : document.elements[target.elementId] !== undefined;
  if (!exists) {
    issues.push({
      code: "extension-target-missing",
      path: `extensionInstallations.${installation.id}.target`,
      message: `Extension installation ${installation.id} references a missing target`,
    });
  }
}

function getTargetKey(installation: ExtensionInstallation): string {
  const target = installation.target;
  if (target.kind === "document") return `document:${target.documentId}`;
  if (target.kind === "canvas") return `canvas:${target.canvasId}`;
  return `element:${target.elementId}`;
}
