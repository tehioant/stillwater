import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { createWaterSurface } from "./water";
it("reflects the actual world in a bounded quality-scaled render target", () => {
  const water = createWaterSurface(true);
  expect(water.mesh).toHaveProperty("isReflector", true);
  expect(water.mesh.getRenderTarget().width).toBe(640);
  expect(water.mesh.name).toBe("rippled reflective water");
  const dispose = vi.spyOn(water.mesh.getRenderTarget(), "dispose");
  water.dispose();
  water.dispose();
  expect(dispose).toHaveBeenCalledTimes(1);
});
it("smoothly glides ripple flow toward the mouse and releases the ripple wake on leave", () => {
  const water = createWaterSurface(false);
  const uniforms = (water.mesh.material as THREE.ShaderMaterial).uniforms;
  water.setPointer(new THREE.Vector2(10, 8));
  water.update(1, 1 / 60, false);
  expect(uniforms.uFlow.value.length()).toBeGreaterThan(0);
  expect(uniforms.uFlow.value.length()).toBeLessThan(0.6);
  expect(uniforms.uPointerStrength.value).toBeGreaterThan(0);
  water.setPointer(null);
  for (let i = 0; i < 180; i++) water.update(1 + i / 60, 1 / 60, false);
  expect(uniforms.uPointerStrength.value).toBeLessThan(0.001);
  expect(water.mesh.getRenderTarget().width).toBe(320);
  water.dispose();
});
