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
it("leaves spreading wave packets at the mouse path instead of dragging one ripple centre", () => {
  const water = createWaterSurface(true);
  const uniforms = (water.mesh.material as THREE.ShaderMaterial).uniforms;
  water.setPointer(new THREE.Vector2(2, 3));
  water.update(0, 0.05, false);
  const waves = uniforms.uRipples?.value as THREE.Vector4[] | undefined;
  expect(waves).toBeDefined();
  const first = waves!.find((wave) => wave.w > 0)!;
  expect(first).toBeDefined();
  const origin = [first.x, first.y];
  water.setPointer(new THREE.Vector2(4, 3));
  water.update(0.05, 0.05, false);
  expect([first.x, first.y]).toEqual(origin);
  expect(first.z).toBeGreaterThan(0);
  expect(waves!.filter((wave) => wave.w > 0).length).toBeGreaterThan(1);
  water.dispose();
});

it("keeps calm water until the first pointer input and does not emit continuously at rest", () => {
  const water = createWaterSurface(true);
  const waves = (water.mesh.material as THREE.ShaderMaterial).uniforms.uRipples
    .value as THREE.Vector4[];
  expect(waves.every((wave) => wave.w === 0)).toBe(true);
  water.setPointer(new THREE.Vector2(2, 3));
  for (let i = 0; i < 12; i++) water.update(i * 0.05, 0.05, false);
  expect(waves.filter((wave) => wave.w > 0)).toHaveLength(1);
  water.dispose();
});

it("lets the wake spread after leaving, then clears it without continuous emissions", () => {
  const water = createWaterSurface(false);
  const waves = (water.mesh.material as THREE.ShaderMaterial).uniforms.uRipples
    .value as THREE.Vector4[];
  water.setPointer(new THREE.Vector2(2, 3));
  water.update(0, 0.05, false);
  water.setPointer(null);
  water.update(0.25, 0.25, false);
  expect(waves.some((wave) => wave.w > 0 && wave.z >= 0.25)).toBe(true);
  for (let i = 0; i < 28; i++) water.update(0.5 + i * 0.25, 0.25, false);
  expect(waves.every((wave) => wave.w === 0)).toBe(true);
  water.dispose();
});

it("bounds the wake buffer and freezes its current pose under reduced motion", () => {
  const water = createWaterSurface(false);
  const waves = (water.mesh.material as THREE.ShaderMaterial).uniforms.uRipples
    .value as THREE.Vector4[];
  for (let i = 0; i < 100; i++) {
    water.setPointer(new THREE.Vector2(i * 0.5, 3));
    water.update(i * 0.05, 0.05, false);
  }
  expect(waves.length).toBe(8);
  expect(waves.every((wave) => wave.toArray().every(Number.isFinite))).toBe(
    true,
  );
  const frozen = waves.map((wave) => wave.toArray());
  water.setPointer(new THREE.Vector2(12, 8));
  water.update(20, 0.25, true);
  expect(waves.map((wave) => wave.toArray())).toEqual(frozen);
  water.dispose();
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
