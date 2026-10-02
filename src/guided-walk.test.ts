import { describe, expect, it } from "vitest";
import { initialNavigation } from "./navigation";
import { advanceMountainWalk } from "./guided-walk";
import { advancePassage, createPassage } from "./passage";

describe("guided mountain walk", () => {
  it("walks at a bounded speed toward the real passage from an off-centre view", () => {
    const nav = { ...initialNavigation(), x: 18, z: 5, yaw: Math.PI * 4 + 2 };
    const before = { ...nav };
    advanceMountainWalk(nav, 0.25);
    expect(Math.hypot(nav.x - before.x, nav.z - before.z)).toBeCloseTo(0.6);
    expect(Math.hypot(nav.x, nav.z + 25)).toBeLessThan(
      Math.hypot(before.x, before.z + 25),
    );
    expect(Math.abs(nav.yaw - before.yaw)).toBeLessThan(1);
    expect(nav.vx).toBe(0);
    expect(nav.vz).toBe(0);
  });
  it("reaches and triggers the existing passage without overshooting or teleporting", () => {
    const nav = initialNavigation();
    const passage = createPassage();
    for (let i = 0; i < 1000 && passage.phase === "idle"; i++) {
      advanceMountainWalk(nav, 0.05);
      advancePassage(passage, nav, 1, 0.05, false);
      expect(Math.hypot(nav.x, nav.z)).toBeLessThanOrEqual(27);
    }
    expect(passage.phase).toBe("travel");
    expect(passage.opening).toBeGreaterThan(0.75);
  });
  it("clamps delayed frames and stops exactly at the mountain anchor", () => {
    const nav = { ...initialNavigation(), x: 0.01, z: -24.99, yaw: 0 };
    advanceMountainWalk(nav, 10);
    expect(nav.x).toBeCloseTo(0);
    expect(nav.z).toBeCloseTo(-25);
    const pose = { ...nav };
    advanceMountainWalk(nav, -1);
    expect(nav).toEqual(pose);
  });
});
