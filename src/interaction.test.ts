import { describe, expect, it } from "vitest";
import { interactionTarget } from "./interaction";
describe("pond responses", () => {
  it("opens nearby lotus a little, farther on hover, and ignores distant hover", () => {
    expect(interactionTarget("lotus", 2, false)).toBeGreaterThan(0);
    expect(interactionTarget("lotus", 2, true)).toBe(1);
    expect(interactionTarget("lotus", 20, true)).toBe(0);
    expect(interactionTarget("lotus", 7, false)).toBe(0);
  });
  it("warms lanterns on approach or hover and fades them with distance", () => {
    expect(interactionTarget("lantern", 2, false)).toBeGreaterThan(
      interactionTarget("lantern", 6, false),
    );
    expect(interactionTarget("lantern", 6, true)).toBe(1);
    expect(interactionTarget("lantern", 10, true)).toBe(0);
  });
});
