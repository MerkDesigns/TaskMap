import { describe, expect, it } from "vitest";
import { createCardContainerInput, TEST_IDS } from "../../src/elements/cardContainerTestFixtures";
import { scrambleDocument, scrambleText } from "./scrambleDocument";

const NEW_DATABASE_ID = "database-00000000-0000-4000-8000-0000000000ff";
let seed = 0;
const options = { databaseId: NEW_DATABASE_ID, randomInt: (below: number) => seed++ % below };

function documentInput() {
  const input = createCardContainerInput();
  input.canvases[TEST_IDS.canvasA].name = "Private plans";
  input.elements[TEST_IDS.elementB].data.link = "https://example.com/secret";
  input.extensionInstallations = {
    [TEST_IDS.extensionA]: {
      id: TEST_IDS.extensionA,
      extensionId: "workflow",
      target: { kind: "element", elementId: TEST_IDS.elementB },
      enabled: true,
      configuration: {
        lines: [
          {
            invocations: [{ kind: "run", executable: "npm", arguments: ["run", "dev"] }],
            workingDirectory: "C:\\Users\\Someone\\Project",
            display: "background",
          },
        ],
      },
    },
    [TEST_IDS.extensionB]: {
      id: TEST_IDS.extensionB,
      extensionId: "search",
      target: { kind: "element", elementId: TEST_IDS.elementA },
      enabled: true,
      configuration: { query: "groceries" },
    },
  };
  return input;
}

describe("scrambleText", () => {
  it("replaces letters and digits but keeps case, spacing and symbols", () => {
    const scrambled = scrambleText("Buy 2 apples!\nÄpfel, café 🍎", (below) => below - 1);
    expect(scrambled).toBe("Zzz 9 zzzzzz!\nZzzzz, zzzz 🍎");
  });
});

describe("scrambleDocument", () => {
  it("scrambles every text and keeps the structure the app renders", () => {
    const input = documentInput();
    const result = scrambleDocument(input, options);
    if (!result.ok) throw new Error(result.error);
    const { document } = result;

    const card = document.elements[TEST_IDS.elementB];
    const container = document.elements[TEST_IDS.elementA];
    expect(card.data.text).not.toBe("First line\n第二行");
    expect(card.data.text).toMatch(/^[a-z]{5} [a-z]{4}\n[a-z]{3}$/i);
    expect(card.data.link).not.toContain("example");
    expect(card.data.accent).toBe("#fedcba");
    expect(card.data.placement).toEqual({ containerId: TEST_IDS.elementA, order: 3 });
    expect(container.data.name).toHaveLength("Ideas 🗂️".length);
    expect(container.geometry).toEqual(input.elements[TEST_IDS.elementA].geometry);
    expect(document.canvases[TEST_IDS.canvasA].name).not.toBe("Private plans");
    expect(document.databaseId).toBe(NEW_DATABASE_ID);

    const [workflow, search] = Object.values(document.extensionInstallations);
    const serialized = JSON.stringify(workflow.configuration);
    expect(serialized).not.toMatch(/npm|dev|Someone|Project/);
    expect(serialized).toContain('"display":"background"');
    expect(search.configuration.query).not.toBe("groceries");
  });

  it("reports which keys it scrambled, without their values", () => {
    const result = scrambleDocument(documentInput(), options);
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.scrambledKeys).sort()).toEqual([
      "arguments",
      "executable",
      "link",
      "name",
      "query",
      "text",
      "workingDirectory",
    ]);
  });

  it("refuses input the app would not open", () => {
    const result = scrambleDocument({ schemaVersion: 2 }, options);
    expect(result.ok).toBe(false);
  });
});
