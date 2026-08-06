import type { ExtensionDefinition } from "./extensionDefinition";

const registeredExtensionDefinitions: readonly ExtensionDefinition[] = Object.freeze([]);

export function getArchitectureExtensionDefinitions(): readonly ExtensionDefinition[] {
  return registeredExtensionDefinitions;
}

export function findArchitectureExtensionDefinition(id: string): ExtensionDefinition | undefined {
  return registeredExtensionDefinitions.find((definition) => definition.id === id);
}
