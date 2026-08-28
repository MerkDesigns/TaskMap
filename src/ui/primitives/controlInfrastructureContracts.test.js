// @vitest-environment node
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { describe, expect, it } from "vitest";

const read = (name) => readFile(new URL(name, import.meta.url), "utf8");

describe("TaskMap control infrastructure", () => {
  it("draws the production Checkbox mark with one reversible SVG stroke", async () => {
    const [component, styles] = await Promise.all([
      read("./SelectionControls.tsx"),
      read("./controls.css"),
    ]);

    expect(component).toContain('className="taskmap-check-control__mark"');
    expect(component).toContain('pathLength="1"');
    expect(styles).toContain("stroke-dasharray: 1");
    expect(styles).toContain("stroke-dashoffset: 1");
    expect(styles).toContain("stroke-dashoffset: 0");
    expect(styles).toMatch(/prefers-reduced-motion[\s\S]*taskmap-check-control__mark/);
    expect(styles).not.toMatch(/taskmap-check-control__input:checked[\s\S]{0,240}linear-gradient/);
  });

  it("keeps Mantine behind the TaskMap Slider, Select, Tooltip, and provider boundaries", async () => {
    const [selection, forms, tooltip, provider] = await Promise.all([
      read("./SelectionControls.tsx"),
      read("./FormControls.tsx"),
      read("./Tooltip.tsx"),
      read("../providers/TaskMapMantineProvider.tsx"),
    ]);

    expect(selection).toContain("Slider as MantineSlider");
    expect(forms).toContain("Select as MantineSelect");
    expect(tooltip).toContain("Tooltip as MantineTooltip");
    expect(provider).toContain("MantineProvider");
    expect(provider).toContain("withGlobalClasses={false}");
  });
});
