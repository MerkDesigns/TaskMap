/** Points uploaded to the shader: the live pointer plus its fading history. */
export const POINTER_TRAIL_CAPACITY = 32;

interface TrailPoint {
  readonly x: number;
  readonly y: number;
  readonly born: number;
}

export interface PointerTrailOptions {
  /** Trail points closer than this (in the same units as positions) are not added. */
  readonly spacing: number;
  /** Milliseconds a trail point takes to fade out completely. */
  readonly duration: number;
}

/**
 * A pointer's recent path as a fixed number of fading points. Fast moves are filled in with
 * interpolated points so the trail has no gaps; when the buffer is full the oldest points go first.
 * The live pointer position is always the first, full-strength point while the pointer is present.
 */
export function createPointerTrail() {
  let points: TrailPoint[] = [];
  let pointer: { x: number; y: number } | null = null;
  const output = new Float32Array(POINTER_TRAIL_CAPACITY * 4);

  return {
    move(x: number, y: number) {
      pointer = { x, y };
    },
    leave() {
      pointer = null;
    },
    /**
     * Advances the trail to `now` and returns its points as `[x, y, strength, 0]` quadruples
     * (strength 0 marks unused slots) and the number of used slots.
     */
    sample(now: number, { spacing, duration }: PointerTrailOptions) {
      if (pointer) {
        const last = points[points.length - 1];
        if (!last) {
          points.push({ ...pointer, born: now });
        } else {
          const distance = Math.hypot(pointer.x - last.x, pointer.y - last.y);
          const steps = Math.min(POINTER_TRAIL_CAPACITY, Math.floor(distance / spacing));
          for (let step = 1; step <= steps; step += 1) {
            const t = step / steps;
            points.push({
              x: last.x + (pointer.x - last.x) * t,
              y: last.y + (pointer.y - last.y) * t,
              born: now,
            });
          }
        }
      }
      points = points.filter((point) => now - point.born < duration);
      // One slot is reserved for the live pointer.
      if (points.length > POINTER_TRAIL_CAPACITY - 1) {
        points = points.slice(points.length - (POINTER_TRAIL_CAPACITY - 1));
      }

      output.fill(0);
      let count = 0;
      const write = (x: number, y: number, strength: number) => {
        output.set([x, y, strength, 0], count * 4);
        count += 1;
      };
      if (pointer) write(pointer.x, pointer.y, 1);
      for (const point of points) {
        const remaining = 1 - (now - point.born) / duration;
        write(point.x, point.y, remaining * remaining);
      }
      return { points: output, count };
    },
  };
}
