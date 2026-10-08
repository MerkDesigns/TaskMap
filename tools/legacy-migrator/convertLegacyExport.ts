// Converts the data inside a legacy TaskMap 0.3 export (`.tmap`, schema version 2) into a
// TaskMap document. This is the one place legacy data shapes are read; the app itself never sees
// them. The result is checked with the app's own document validation and canvas projection, so a
// migrated database opens exactly like one the app wrote.
import { z } from "zod";
import { convertLegacyExtensions, type ConversionLog } from "./legacyExtensions";
import { legacyAppDataSchema, legacyImageSchema, type LegacyCanvas } from "./legacyExportSchema";
import { createLegacyMediaStore, type MigratedMedia } from "./legacyMedia";
import { createRetainedCanvasProjection } from "../../src/app/view-projection/createRetainedCanvasProjection";
import { DEFAULT_ELEMENT_COLORS } from "../../src/constants";
import { CURRENT_DOCUMENT_SCHEMA_VERSION } from "../../src/domain/document/documentSchema";
import type { DatabasePurpose, TaskMapDocument } from "../../src/domain/document/documentTypes";
import { DOCUMENT_LIMITS } from "../../src/domain/document/documentLimits";
import { validateTaskMapDocument } from "../../src/domain/document/validateDocument";
import { createEntityId, type UuidSource } from "../../src/domain/ids/entityIds";

export type { MigratedMedia };

export interface MigrationReport {
  readonly counts: Readonly<Record<string, number>>;
  /** What could not come across unchanged, for the person migrating to read. */
  readonly notes: readonly string[];
}

export type MigrationResult =
  | {
      readonly ok: true;
      readonly document: TaskMapDocument;
      readonly media: readonly MigratedMedia[];
      readonly report: MigrationReport;
    }
  | { readonly ok: false; readonly error: string };

export interface MigrationOptions {
  readonly databaseId: string;
  readonly databasePurpose: DatabasePurpose;
  readonly ids: UuidSource;
  /** 18 random bytes per media item; media ids are 24 base64url characters. */
  readonly randomBytes: (length: number) => Uint8Array;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const label = (text: string) => {
  const line = text.split("\n")[0]?.trim() ?? "";
  return line.length > 40 ? `"${line.slice(0, 40)}…"` : `"${line}"`;
};

/**
 * Converts a decrypted legacy export (`{ data, images }`, or a bare `data` object from exports
 * written before images were bundled) into a validated document plus the media to store.
 */
export function convertLegacyExport(body: unknown, options: MigrationOptions): MigrationResult {
  const envelope =
    typeof body === "object" && body !== null && "data" in body
      ? (body as { data: unknown; images?: unknown })
      : { data: body, images: [] };
  const parsedData = legacyAppDataSchema.safeParse(envelope.data);
  if (!parsedData.success) {
    const issue = parsedData.error.issues[0];
    return {
      ok: false,
      error: `The export is not TaskMap 0.3 data (${issue?.path.join(".") || "root"}: ${issue?.message})`,
    };
  }
  const parsedImages = z.array(legacyImageSchema).safeParse(envelope.images ?? []);
  if (!parsedImages.success) return { ok: false, error: "The export's bundled images are invalid" };

  const legacy = parsedData.data;
  const notes: string[] = [];
  const counts: Record<string, number> = {};
  const count = (key: string) => (counts[key] = (counts[key] ?? 0) + 1);
  const log: ConversionLog = { note: (text) => notes.push(text), count };
  const newId = <Kind extends Parameters<typeof createEntityId>[0]>(kind: Kind) =>
    createEntityId(kind, options.ids);

  const document: TaskMapDocument = {
    schemaVersion: CURRENT_DOCUMENT_SCHEMA_VERSION,
    id: newId("document"),
    databaseId: options.databaseId as TaskMapDocument["databaseId"],
    databasePurpose: options.databasePurpose,
    activeCanvasId: null,
    canvasOrder: [],
    canvases: {},
    elements: {},
    connections: {},
    mediaReferences: {},
    extensionInstallations: {},
    documentSettings: {
      grid: {
        style: legacy.canvasGridStyle,
        opacityPercent: {
          dots: clamp(legacy.canvasGridOpacity.dots, 0, 100),
          lines: clamp(legacy.canvasGridOpacity.lines, 0, 100),
        },
      },
      showElementShadows: legacy.shadowsUnderElements,
      allowLockedElementDeletion: legacy.allowLockedElementDeletion,
      minimapEnabled: legacy.minimapEnabled,
    },
  } as TaskMapDocument;
  const mutable = document as unknown as {
    activeCanvasId: string | null;
    canvasOrder: string[];
    canvases: Record<string, unknown>;
    elements: Record<string, unknown>;
    connections: Record<string, unknown>;
    mediaReferences: Record<string, unknown>;
    extensionInstallations: Record<string, unknown>;
  };

  const mediaStore = createLegacyMediaStore(parsedImages.data, options.randomBytes, log);
  mutable.mediaReferences = mediaStore.references;
  const mediaFor = mediaStore.mediaFor;

  const canvasIds = new Map<string, string>();
  for (const canvas of legacy.canvases) {
    const canvasId = newId("canvas");
    canvasIds.set(canvas.id, canvasId);
    convertCanvas(canvas, canvasId);
    count("canvases");
  }
  mutable.activeCanvasId = canvasIds.get(legacy.activeCanvasId) ?? mutable.canvasOrder[0] ?? null;

  function convertCanvas(canvas: LegacyCanvas, canvasId: string) {
    let name = canvas.name.trim() || "Untitled canvas";
    if (name.length > DOCUMENT_LIMITS.canvasNameLength) {
      name = name.slice(0, DOCUMENT_LIMITS.canvasNameLength);
      notes.push(`Canvas ${label(canvas.name)}: its name was shortened to fit.`);
    }
    const canvasLabel = `Canvas ${label(name)}`;
    const dimension = (value: number) =>
      Number.isFinite(value) && value > 0
        ? Math.min(value, DOCUMENT_LIMITS.canvasDimension)
        : 3_000;
    mutable.canvasOrder.push(canvasId);
    const elementOrder: string[] = [];
    mutable.canvases[canvasId] = {
      id: canvasId,
      name,
      settings: { width: dimension(canvas.width), height: dimension(canvas.height) },
      elementOrder,
    };

    const ids = new Map<string, string>();
    const containerIds = new Set(canvas.containers.map(({ id }) => id));
    const coordinate = (value: number) =>
      clamp(
        Number.isFinite(value) ? value : 0,
        -DOCUMENT_LIMITS.elementCoordinateMagnitude,
        DOCUMENT_LIMITS.elementCoordinateMagnitude,
      );
    const extent = (value: number) =>
      clamp(Number.isFinite(value) && value > 0 ? value : 1, 1, DOCUMENT_LIMITS.elementDimension);
    const box = (element: { x: number; y: number; width: number; height: number }) => ({
      x: coordinate(element.x),
      y: coordinate(element.y),
      width: extent(element.width),
      height: extent(element.height),
    });
    // Cards size themselves to their text; their stored geometry only places them.
    const point = (element: { x: number; y: number }) => ({
      x: coordinate(element.x),
      y: coordinate(element.y),
      width: 1,
      height: 1,
    });

    // Children of each container in their saved order, numbered 0..n-1 as the document requires.
    const placements = new Map<string, { containerId: string; order: number }>();
    const children = new Map<string, { id: string; order: number; index: number }[]>();
    const contained = [
      ...canvas.textCards.filter((card) => card.kind !== "mindmap"),
      ...canvas.images,
    ];
    contained.forEach((child, index) => {
      if (!child.containerId) return;
      if (!containerIds.has(child.containerId)) {
        notes.push(
          `${canvasLabel}: an element pointed at a container that no longer exists; it is placed on the canvas instead.`,
        );
        return;
      }
      const list = children.get(child.containerId) ?? [];
      list.push({ id: child.id, order: child.order ?? Number.MAX_SAFE_INTEGER, index });
      children.set(child.containerId, list);
    });

    // Paint order: the legacy app drew top-level elements by layer, unlayered ones last.
    const topLevel = [
      ...canvas.containers,
      ...canvas.textBlocks,
      ...canvas.textCards.filter(
        (card) =>
          card.kind === "mindmap" || !card.containerId || !containerIds.has(card.containerId),
      ),
      ...canvas.images.filter(
        (image) => !image.containerId || !containerIds.has(image.containerId),
      ),
    ]
      .map((element, index) => ({ element, index }))
      .sort(
        (a, b) =>
          (a.element.layer ?? Number.MAX_SAFE_INTEGER) -
            (b.element.layer ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
      );
    const add = (legacyId: string, element: Record<string, unknown>) => {
      const id = newId("element");
      ids.set(legacyId, id);
      mutable.elements[id] = { id, canvasId, ...element };
    };

    for (const container of canvas.containers) {
      add(container.id, {
        type: "container",
        geometry: box(container),
        data: {
          name: container.name,
          accent: container.accent || DEFAULT_ELEMENT_COLORS.container,
          headerButtonsVisible: container.headerButtonsVisible ?? true,
        },
      });
      count("containers");
      (children.get(container.id) ?? [])
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .forEach((child, order) => placements.set(child.id, { containerId: container.id, order }));
    }
    for (const block of canvas.textBlocks) {
      add(block.id, {
        type: "text-block",
        geometry: box(block),
        data: {
          name: block.name,
          text: block.text,
          accent: block.accent || DEFAULT_ELEMENT_COLORS.textBlock,
          headerButtonsVisible: block.headerButtonsVisible ?? true,
        },
      });
      count("text blocks");
    }
    for (const card of canvas.textCards) {
      if (card.kind === "mindmap") {
        if (card.containerId)
          notes.push(
            `Mind-map node ${label(card.text)} was inside a container; it is on the canvas now.`,
          );
        add(card.id, {
          type: "mind-map-node",
          geometry: point(card),
          data: { text: card.text, accent: card.accent || DEFAULT_ELEMENT_COLORS.mindmap },
        });
        count("mind-map nodes");
        continue;
      }
      const placement = placements.get(card.id);
      add(card.id, {
        type: "text-card",
        geometry: point(card),
        data: {
          text: card.text,
          accent: card.accent || DEFAULT_ELEMENT_COLORS.textCard,
          link: card.link?.trim() ? card.link : null,
          placement: placement
            ? { containerId: ids.get(placement.containerId), order: placement.order }
            : null,
        },
      });
      count("text cards");
    }
    for (const image of canvas.images) {
      const placement = placements.get(image.id);
      add(image.id, {
        type: "image",
        geometry: box(image),
        data: {
          mediaId: image.imageId ? mediaFor(image.imageId, `An image on ${canvasLabel}`) : null,
          accent: image.accent || DEFAULT_ELEMENT_COLORS.image,
          background: image.background !== false,
          placement: placement
            ? { containerId: ids.get(placement.containerId), order: placement.order }
            : null,
        },
      });
      count("images");
    }

    for (const { element } of topLevel) elementOrder.push(ids.get(element.id)!);
    for (const [legacyId, id] of ids) if (placements.has(legacyId)) elementOrder.push(id);

    // Extensions, after every element exists so card extensions can see their element.
    const all = [...canvas.containers, ...canvas.textBlocks, ...canvas.textCards, ...canvas.images];
    for (const element of all) {
      const elementId = ids.get(element.id)!;
      const type = (mutable.elements[elementId] as { type: string }).type;
      const name =
        "name" in element
          ? label(element.name)
          : "text" in element
            ? label(element.text)
            : "an image";
      for (const installation of convertLegacyExtensions(
        element.extensions,
        { elementId, type, name },
        () => newId("extension-instance"),
        log,
      ))
        mutable.extensionInstallations[installation.id] = installation;
    }

    // Connections, without the self- and duplicate links the app refuses.
    const pairs = new Set<string>();
    for (const connection of canvas.mindmapConnections) {
      const source = ids.get(connection.sourceId);
      const target = ids.get(connection.targetId);
      const pair = [source, target].sort().join("|");
      if (!source || !target || source === target || pairs.has(pair)) {
        notes.push(`${canvasLabel}: a connection to a missing or repeated element was left out.`);
        continue;
      }
      pairs.add(pair);
      const id = newId("connection");
      mutable.connections[id] = {
        id,
        canvasId,
        type: "mind-map",
        source: { elementId: source, portId: connection.sourcePort },
        target: { elementId: target, portId: connection.targetPort },
        data: {},
      };
      count("connections");
    }
  }

  notes.push(
    "Not carried over: each canvas's last view position and zoom, default element colours, recent colours, privacy mode, toolbar visibility and Discord settings. Set them again in TaskMap Beta if you want them.",
  );

  const validated = validateTaskMapDocument(document);
  if (!validated.ok) {
    return {
      ok: false,
      error: `The converted document is invalid (${validated.stage}: ${JSON.stringify(validated.issues[0])})`,
    };
  }
  const projection = createRetainedCanvasProjection();
  try {
    const projected = projection.project(validated.document);
    if (!projected.ok) {
      const codes = [...new Set(projected.issues.map(({ code }) => code))].join(", ");
      return { ok: false, error: `The app would refuse the converted document (${codes})` };
    }
  } finally {
    projection.clear();
  }
  return {
    ok: true,
    document: validated.document,
    media: mediaStore.media,
    report: { counts, notes },
  };
}
