import { MATERIAL_DEFINITIONS } from "./materialDefinitions";
import type { MaterialDefinition, MaterialId } from "./materialTypes";

export interface MaterialRegistry {
  readonly ids: readonly MaterialId[];
  get(id: string): MaterialDefinition | undefined;
  require(id: string): MaterialDefinition;
}

export function createMaterialRegistry(
  definitions: readonly MaterialDefinition[],
): MaterialRegistry {
  const byId = new Map<MaterialId, MaterialDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate material definition: ${definition.id}`);
    }
    byId.set(definition.id, definition);
  }

  const ids = Object.freeze([...byId.keys()]);

  return Object.freeze({
    ids,
    get(id: string) {
      return byId.get(id as MaterialId);
    },
    require(id: string) {
      const definition = byId.get(id as MaterialId);
      if (!definition) throw new Error(`Unknown material: ${id}`);
      return definition;
    },
  });
}

export const materialRegistry = createMaterialRegistry(MATERIAL_DEFINITIONS);
