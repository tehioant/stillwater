import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createWorld } from "./world";

describe("createWorld scene contract", () => {
  it("unfolds real lotus petals with independent morph targets instead of just enlarging the flower", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "high");
    const [one, two] = world.interactive.filter((e) => e.kind === "lotus");
    const bloom = (e: typeof one) =>
      e.object.children.find((c) => c.name === "lotus bloom") as THREE.Mesh;
    expect(bloom(one).geometry.morphAttributes.position?.length).toBe(1);
    world.update(0, 1, true);
    const other = bloom(two).morphTargetInfluences![0];
    one.response = 1;
    world.update(1, 1, true);
    expect(bloom(one).morphTargetInfluences![0]).toBeGreaterThan(other + 0.2);
    expect(bloom(two).morphTargetInfluences![0]).toBeCloseTo(other);
    world.dispose();
  });

  it.each([
    ["high", 2400],
    ["low", 1200],
  ] as const)(
    "fills the %s sky with at least %i quiet, finite stars",
    (quality, minimum) => {
      const world = createWorld(
        null as unknown as THREE.WebGLRenderer,
        quality,
      );
      const stars = world.scene.getObjectByName("quiet stars") as THREE.Points;
      expect(stars).toBeInstanceOf(THREE.Points);
      const positions = stars.geometry.getAttribute("position");
      expect(positions.count).toBeGreaterThanOrEqual(minimum);
      expect(stars.geometry.getAttribute("aSize").count).toBe(positions.count);
      expect(stars.geometry.getAttribute("aPhase").count).toBe(positions.count);
      for (let i = 0; i < positions.count; i++) {
        expect(positions.getY(i)).toBeGreaterThan(0);
        expect(Number.isFinite(positions.getX(i))).toBe(true);
      }
      world.dispose();
    },
  );

  it("turns only the hovered lantern red and returns to amber on leave", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const [one, two] = world.interactive.filter((e) => e.kind === "lantern");
    const shell = (e: typeof one) =>
      e.object.children.find(
        (n) =>
          n instanceof THREE.Mesh && n.geometry instanceof THREE.SphereGeometry,
      ) as THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
    const first = shell(one).material;
    const other = shell(two).material;
    one.response = 1;
    world.update(0, 1, false);
    const amber = first.color.clone();
    one.hovered = true;
    world.update(1, 1, false);
    expect(first.color.g).toBeLessThan(amber.g * 0.5);
    expect(other.color.g).toBeGreaterThan(first.color.g);
    const halo = one.object.children.find(
      (n) => n instanceof THREE.Sprite,
    ) as THREE.Sprite;
    expect(halo.material.color.g).toBeLessThan(0.2);
    one.hovered = false;
    world.update(2, 1, false);
    expect(first.color.g).toBeGreaterThan(amber.g * 0.9);
    world.dispose();
  });

  it("mixes water-level and hovering lanterns at several heights", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const lanterns = world.interactive.filter((e) => e.kind === "lantern");
    expect(lanterns.some((e) => e.position.y < 0.2)).toBe(true);
    expect(
      lanterns.filter((e) => e.position.y > 2).length,
    ).toBeGreaterThanOrEqual(3);
    world.dispose();
  });

  it("creates a navigable pond scene with a foreground pair of lotuses and lantern", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "high");
    expect(world.scene).toBeInstanceOf(THREE.Scene);
    expect(world.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(world.camera.position.toArray()).toEqual([0, 2.2, 12]);
    expect(
      world.interactive.filter((item) => item.kind === "lotus").length,
    ).toBeGreaterThanOrEqual(2);
    expect(world.interactive.some((item) => item.kind === "lantern")).toBe(
      true,
    );
    expect(
      world.interactive.filter(
        ({ object }) => object.position.distanceTo(world.camera.position) < 5.5,
      ).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      world.interactive.some(
        ({ id, position }) =>
          id === "lotus-1" && position.toArray().join(",") === "-1.3,0,8",
      ),
    ).toBe(true);
    expect(world.scene.children.length).toBeGreaterThan(10);
    expect(
      world.interactive.every(
        ({ object, position, response }) =>
          object.parent !== null &&
          position.distanceTo(object.position) < 1e-6 &&
          response === 0,
      ),
    ).toBe(true);
    world.dispose();
  });

  it("keeps a nearby lotus on the portrait centerline for touch interaction", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const lotus = world.interactive.find(
      (entity) => entity.kind === "lotus" && Math.abs(entity.position.x) <= 0.5,
    )!;
    expect(lotus).toBeDefined();
    expect(
      Math.hypot(
        lotus.position.x - world.camera.position.x,
        lotus.position.z - world.camera.position.z,
      ),
    ).toBeLessThanOrEqual(5.5);
    world.dispose();
  });

  it("gives the lantern a feathered halo and visible horizontal ribs", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const lantern = world.interactive.find((item) => item.kind === "lantern")!;
    expect(
      lantern.object.children.some((child) => child instanceof THREE.Sprite),
    ).toBe(true);
    const hoop = lantern.object.children.find(
      (child) =>
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.TorusGeometry,
    ) as THREE.Mesh;
    expect(Math.abs(hoop.rotation.x)).toBeCloseTo(Math.PI / 2);
    expect(
      (
        lantern.object.children.find(
          (child) => child instanceof THREE.Mesh,
        ) as THREE.Mesh
      ).material,
    ).toBeInstanceOf(THREE.MeshStandardMaterial);
    world.dispose();
  });

  it("opens lotus petals and brightens lanterns as response rises", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "high");
    const lotus = world.interactive.find((item) => item.kind === "lotus")!;
    const lantern = world.interactive.find((item) => item.kind === "lantern")!;
    const bloom = lotus.object.children.find(
      (child) => child.name === "lotus bloom",
    ) as THREE.Mesh;
    world.update(0, 1, true);
    const closed = bloom.scale.x;
    const light = lantern.object.children.find(
      (child) => child instanceof THREE.PointLight,
    ) as THREE.PointLight;
    const dim = light.intensity;
    lotus.response = 1;
    lantern.response = 1;
    world.update(1, 1, true);
    expect(bloom.scale.x).toBeGreaterThan(closed);
    expect(light.intensity).toBeGreaterThan(dim);
    world.dispose();
  });

  it("freezes ambient motion and floating entities at their current pose under reduced motion", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const lantern = world.interactive.find((item) => item.kind === "lantern")!;
    world.update(5, 0.5, false);
    const floatingPose = lantern.object.position.y;
    const water = world.scene.getObjectByName(
      "rippled reflective water",
    ) as THREE.Mesh;
    const waterPose = water.position.y;
    world.update(6, 0.5, true);
    expect(lantern.object.position.y).toBe(floatingPose);
    expect(water.position.y).toBe(waterPose);
    expect((water.material as THREE.ShaderMaterial).uniforms.uTime.value).toBe(
      5,
    );
    world.dispose();
  });

  it("fills the pond with organic lily pads and surrounds the horizon with layered ridges", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "high");
    let padInstances = 0;
    const mountains: THREE.Object3D[] = [];
    world.scene.traverse((node) => {
      if (
        node.name === "water lily pads" &&
        node instanceof THREE.InstancedMesh
      )
        padInstances += node.count;
      if (node.name === "karst ridge") mountains.push(node);
    });
    expect(padInstances).toBeGreaterThanOrEqual(24);
    expect(mountains.length).toBeGreaterThanOrEqual(20);
    const horizonSectors = new Set(
      mountains.map(({ position }) =>
        Math.floor(
          (Math.atan2(position.x, position.z) + Math.PI) / (Math.PI / 4),
        ),
      ),
    );
    expect(horizonSectors.size).toBeGreaterThanOrEqual(8);
    world.dispose();
  });

  it("disposes shared sprite materials and their texture once", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const mist = world.scene.children.find(
      (node) => node instanceof THREE.Sprite,
    ) as THREE.Sprite;
    const materialDispose = vi.spyOn(mist.material, "dispose");
    const textureDispose = vi.spyOn(mist.material.map!, "dispose");
    world.dispose();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    world.dispose();
  });

  it("disposes owned scene resources and is safe to dispose twice", () => {
    const world = createWorld(null as unknown as THREE.WebGLRenderer, "low");
    const geometry = (
      world.scene.children.find(
        (node) => node instanceof THREE.Mesh,
      ) as THREE.Mesh
    ).geometry;
    const disposeGeometry = vi.spyOn(geometry, "dispose");
    world.dispose();
    world.dispose();
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(world.scene.children).toHaveLength(0);
  });
});
