import type { ElementDefinition } from "./elementDefinition";

const registeredElementDefinitions: readonly ElementDefinition[] = Object.freeze([]);

export function getElementDefinitions(): readonly ElementDefinition[] {
  return registeredElementDefinitions;
}

export function findElementDefinition(type: string): ElementDefinition | undefined {
  return registeredElementDefinitions.find((definition) => definition.type === type);
}
