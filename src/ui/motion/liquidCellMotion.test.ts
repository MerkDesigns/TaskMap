// @vitest-environment node
import { describe, expect, it } from "vitest";
import { advanceLiquidCell, createLiquidCellState, type LiquidCellFrame } from "./liquidCellMotion";

const SETTLED_RADIUS = 8;
const from = { x: 20, y: 20, size: 36 };
const diagonal = { x: 140, y: 140, size: 36 };

function run(frames: number, target = diagonal): LiquidCellFrame {
  let frame = advanceLiquidCell(createLiquidCellState(from), target, 1000 / 120, SETTLED_RADIUS);
  for (let index = 1; index < frames; index++) {
    frame = advanceLiquidCell(frame.state, target, 1000 / 120, SETTLED_RADIUS);
  }
  return frame;
}

describe("liquid cell motion", () => {
  it("settles exactly on its target at its resting shape", () => {
    const last = run(600);
    expect(last).toMatchObject({
      x: 140,
      y: 140,
      length: 36,
      thickness: 36,
      angle: 0,
      radius: SETTLED_RADIUS,
      settled: true,
    });
  });

  it("stretches and turns along a diagonal move, rounding while it travels", () => {
    const moving = run(12);
    expect(moving.settled).toBe(false);
    expect(moving.length).toBeGreaterThan(36);
    expect(moving.angle).toBeCloseTo(45, 0);
    expect(moving.radius).toBeGreaterThan(SETTLED_RADIUS);
    expect(moving.radius).toBeLessThanOrEqual(18);
  });

  it("keeps a capsule's angle within a half turn when moving up and left", () => {
    const moving = run(12, { x: -100, y: -100, size: 36 });
    expect(moving.angle).toBeCloseTo(45, 0);
  });

  it("keeps moving after a first frame in which no time has passed", () => {
    const first = advanceLiquidCell(createLiquidCellState(from), diagonal, 0, SETTLED_RADIUS);
    expect(first.settled).toBe(false);
  });

  it("glides without changing shape when rigid", () => {
    let frame = advanceLiquidCell(
      createLiquidCellState(from),
      diagonal,
      8,
      SETTLED_RADIUS,
      false,
      true,
    );
    for (let index = 0; index < 10; index++) {
      frame = advanceLiquidCell(frame.state, diagonal, 8, SETTLED_RADIUS, false, true);
    }
    expect(frame.settled).toBe(false);
    expect(frame.x).toBeGreaterThan(from.x);
    expect(frame).toMatchObject({ length: 36, thickness: 36, angle: 0, radius: SETTLED_RADIUS });
  });

  it("jumps straight to the target with reduced motion", () => {
    const frame = advanceLiquidCell(
      createLiquidCellState(from),
      diagonal,
      16,
      SETTLED_RADIUS,
      true,
    );
    expect(frame).toMatchObject({ x: 140, y: 140, length: 36, settled: true });
  });
});
