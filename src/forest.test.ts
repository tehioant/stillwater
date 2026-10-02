import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createForest } from "./forest";

const makeForest = (quality: "low" | "high" = "high") =>
  createForest(null as unknown as THREE.WebGLRenderer, quality);

function fireflies(world: ReturnType<typeof makeForest>) {
  return world.scene.getObjectByName("fireflies") as THREE.Points;
}

describe("createForest", () => {
  it("opens into a moonlit glade with a northward camera and a distinct returning arch", () => {
    const world = makeForest();
    expect(world.camera.position.toArray()).toEqual([0, 2.2, 12]);
    expect(world.camera.getWorldDirection(new THREE.Vector3()).z).toBeLessThan(
      -0.9,
    );
    expect(world.interactive).toEqual([]);
    const stars = world.scene.getObjectByName("quiet stars") as THREE.Points;
    expect(stars.geometry.getAttribute("position").count).toBeGreaterThan(1000);
    expect(
      world.scene.getObjectByName("returning passage • mist arch"),
    ).toBeTruthy();
    expect(world.scene.getObjectByName("moonlit glade backdrop")).toBeTruthy();
    expect(world.scene.getObjectByName("moss banks")).toBeTruthy();
    world.dispose();
  });

  it("makes the forward stream legible between irregular banks and uses the shared reflector", () => {
    const world = makeForest();
    const water = world.scene.getObjectByName("rippled reflective water");
    expect(water).toBeInstanceOf(THREE.Mesh);
    expect(world.scene.getObjectByName("stream stones")).toBeTruthy();
    const banks = world.scene.getObjectByName("moss banks");
    expect(banks?.children.length).toBeGreaterThanOrEqual(2);
    expect(
      world.scene.children.some((child) => child.name === "stream channel"),
    ).toBe(true);
    world.setWaterPointer(new THREE.Vector2(1, -2));
    world.update(1, 0.016, false);
    world.dispose();
  });

  it.each([
    ["high", 100],
    ["low", 36],
  ] as const)(
    "seeds %s-quality fog-safe firefly point halos with position attributes",
    (quality, minimum) => {
      const world = makeForest(quality);
      const glow = fireflies(world);
      expect(glow).toBeInstanceOf(THREE.Points);
      expect(
        glow.geometry.getAttribute("position").count,
      ).toBeGreaterThanOrEqual(minimum);
      expect(glow.material).toBeInstanceOf(THREE.ShaderMaterial);
      const shader = glow.material as THREE.ShaderMaterial;
      expect(shader.uniforms.fogColor).toBeDefined();
      expect(shader.uniforms.fogDensity).toBeDefined();
      expect(shader.fragmentShader).toContain("fog_fragment");
      expect(shader.fragmentShader).toContain("gl_PointCoord");
      const before = glow.geometry.getAttribute("position").array.slice();
      world.update(3.5, 0.016, false);
      expect(glow.geometry.getAttribute("position").array).not.toEqual(before);
      const nextWorld = makeForest(quality);
      const repeatWorld = makeForest(quality);
      expect(
        fireflies(nextWorld).geometry.getAttribute("position").array,
      ).toEqual(fireflies(repeatWorld).geometry.getAttribute("position").array);
      repeatWorld.dispose();
      nextWorld.dispose();
      world.dispose();
    },
  );

  it("freezes fireflies at their current pose in reduced motion, then resumes", () => {
    const world = makeForest("low");
    const glow = fireflies(world);
    world.update(2, 0.016, false);
    const before = glow.geometry.getAttribute("position").array.slice();
    world.update(90, 0.016, true);
    expect(glow.geometry.getAttribute("position").array).toEqual(before);
    world.update(4, 0.016, false);
    expect(glow.geometry.getAttribute("position").array).not.toEqual(before);
    world.dispose();
  });

  it("starts at radius 12 and keeps the designed grove inside the navigable radius", () => {
    const world = makeForest();
    const bounds = new THREE.Box3().setFromObject(world.scene);
    expect(world.camera.position.length()).toBeCloseTo(12.2);
    expect(bounds.max.x).toBeLessThanOrEqual(27);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-27);
    expect(bounds.max.z).toBeLessThanOrEqual(27);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-27);
    world.dispose();
  });

  it("disposes every owned geometry and material exactly once, including when disposed twice", () => {
    const world = makeForest("low");
    const resources = new Set<THREE.BufferGeometry | THREE.Material>();
    world.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) resources.add(mesh.geometry);
      if (Array.isArray(mesh.material))
        mesh.material.forEach((material) => resources.add(material));
      else if (mesh.material) resources.add(mesh.material);
    });
    const spies = [...resources].map((resource) =>
      vi.spyOn(resource, "dispose"),
    );
    world.dispose();
    world.dispose();
    expect(spies.length).toBeGreaterThan(8);
    for (const dispose of spies) expect(dispose).toHaveBeenCalledTimes(1);
  });
});
