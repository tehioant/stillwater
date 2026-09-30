import { describe, expect, it } from "vitest";
import {
  advanceNavigation,
  initialNavigation,
  pointerNavigation,
} from "./navigation";

it("maps mouse direction to bounded glide and turn with a quiet centre", () => {
  expect(pointerNavigation(0, 0)).toEqual({ forward: 0, turn: 0 });
  expect(pointerNavigation(0.4, -0.4)).toEqual({ forward: 0, turn: 0 });
  expect(pointerNavigation(1, 1)).toEqual({ forward: 1, turn: 1 });
  expect(pointerNavigation(-1, -1)).toEqual({ forward: -1, turn: -1 });
  expect(pointerNavigation(-10, -10)).toEqual({ forward: 0, turn: 0 });
});

describe("peaceful navigation", () => {
  it("preserves glide speed at low frame rates using bounded simulation steps", () => {
    const smooth = initialNavigation(),
      slow = initialNavigation();
    for (let i = 0; i < 20; i++)
      advanceNavigation(smooth, { forward: 1, right: 0 }, 0.05);
    for (let i = 0; i < 4; i++)
      advanceNavigation(slow, { forward: 1, right: 0 }, 0.25);
    expect(slow.z).toBeCloseTo(smooth.z, 5);
    expect(slow.vz).toBeCloseTo(smooth.vz, 5);
  });

  it("glides forward from the opening view without changing height", () => {
    const state = initialNavigation();
    for (let i = 0; i < 60; i++)
      advanceNavigation(state, { forward: 1, right: 0 }, 1 / 60);
    expect(state.z).toBeLessThan(11);
    expect(state.y).toBe(2.2);
    expect(state.x).toBeCloseTo(0);
  });
  it("keeps the visitor inside the pond with bounded diagonal speed and tab-return steps", () => {
    const state = initialNavigation();
    for (let i = 0; i < 1800; i++)
      advanceNavigation(state, { forward: 1, right: 1 }, 1 / 60);
    expect(Math.hypot(state.x, state.z)).toBeLessThanOrEqual(27.001);
    const next = initialNavigation();
    advanceNavigation(next, { forward: 1, right: 1 }, 100);
    expect(Math.hypot(next.x, next.z - 12)).toBeLessThan(0.3);
    for (let i = 0; i < 60; i++)
      advanceNavigation(next, { forward: 1, right: 1 }, 1 / 60);
    expect(Math.hypot(next.vx, next.vz)).toBeLessThanOrEqual(2.401);
    for (let i = 0; i < 180; i++)
      advanceNavigation(next, { forward: 0, right: 0 }, 1 / 60);
    expect(Math.hypot(next.vx, next.vz)).toBeLessThan(0.001);
  });
});
