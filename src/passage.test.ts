import { expect, it } from "vitest";
import { initialNavigation } from "./navigation";
import { createPassage, advancePassage, cancelPassage } from "./passage";

it("opens only near the central valley and does not carry a resting or sideways visitor", () => {
  const passage = createPassage();
  const nav = initialNavigation();
  advancePassage(passage, nav, 0, 0.25, false);
  expect(passage.opening).toBe(0);
  nav.z = -23;
  for (let i = 0; i < 20; i++) advancePassage(passage, nav, 0, 0.25, false);
  expect(passage.opening).toBeGreaterThan(0.8);
  expect(passage.phase).toBe("idle");
  nav.yaw = Math.PI / 2;
  advancePassage(passage, nav, 1, 0.25, false);
  expect(passage.phase).toBe("idle");
  nav.x = 15;
  nav.yaw = 0;
  advancePassage(passage, nav, 1, 0.25, false);
  expect(passage.phase).toBe("idle");
});

it("carries an intentional approach through the mountains and switches worlds once behind mist", () => {
  const passage = createPassage();
  const nav = { ...initialNavigation(), z: -23 };
  for (let i = 0; i < 15; i++) advancePassage(passage, nav, 0, 0.25, false);
  advancePassage(passage, nav, 1, 0.25, false);
  expect(passage.phase).toBe("travel");
  const switches: string[] = [];
  let furthest = nav.z;
  for (let i = 0; i < 30; i++) {
    const result = advancePassage(passage, nav, 0, 0.25, false);
    furthest = Math.min(furthest, nav.z);
    if (result.switchTo) {
      switches.push(result.switchTo);
      expect(result.opacity).toBe(1);
    }
  }
  expect(furthest).toBeLessThan(-60);
  expect(switches).toEqual(["forest"]);
  expect(passage.world).toBe("forest");
  expect(passage.phase).toBe("idle");
  expect(nav.z).toBeCloseTo(9.5);
  expect(nav.vx).toBe(0);
  expect(nav.vz).toBe(0);
});

it("returns from the forest passage without immediately retriggering", () => {
  const passage = createPassage("forest");
  const nav = { ...initialNavigation(), z: 16, yaw: Math.PI };
  for (let i = 0; i < 20; i++) advancePassage(passage, nav, 0, 0.25, false);
  advancePassage(passage, nav, 1, 0.25, false);
  const switches: string[] = [];
  for (let i = 0; i < 30; i++) {
    const result = advancePassage(passage, nav, 1, 0.25, false);
    if (result.switchTo) switches.push(result.switchTo);
  }
  expect(switches).toEqual(["pond"]);
  expect(passage.world).toBe("pond");
  expect(passage.phase).toBe("idle");
  expect(nav.z).toBeCloseTo(-20);
  expect(nav.yaw).toBeCloseTo(Math.PI);
});

it("uses a brief fade without camera flight in reduced motion and can cancel safely", () => {
  const passage = createPassage();
  const nav = { ...initialNavigation(), z: -23 };
  advancePassage(passage, nav, 1, 0.1, true);
  expect(passage.phase).toBe("travel");
  const start = nav.z;
  advancePassage(passage, nav, 0, 0.1, true);
  expect(nav.z).toBe(start);
  const switched = advancePassage(passage, nav, 0, 0.25, true);
  expect(switched.switchTo).toBe("forest");
  expect(nav.z).toBe(12);
  cancelPassage(passage);
  expect(passage.world).toBe("forest");
  expect(passage.phase).toBe("idle");
  expect(passage.opacity).toBe(0);
});
