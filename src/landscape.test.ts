import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createPaintedMountains } from "./landscape";

describe("createPaintedMountains", () => {
  it("provides crest-following contours on broad curved ridges", () => {
    const horizon = createPaintedMountains(true);
    for (const ridge of horizon.children as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >[]) {
      const positions = ridge.geometry.getAttribute("position");
      const crests = ridge.geometry.getAttribute("aCrest");
      expect(crests).toBeDefined();
      expect(crests.count).toBe(positions.count);
      for (let i = 0; i < crests.count; i++) {
        expect(crests.getX(i)).toBeGreaterThan(0);
        expect(positions.getY(i)).toBeLessThanOrEqual(crests.getX(i) + 0.001);
      }
      expect(ridge.material.uniforms.uWidth?.value).toBeGreaterThan(0);
      expect(ridge.material.uniforms.uContourColor).toBeDefined();
      expect(ridge.material.uniforms.uContourOpacity.value).toBeLessThanOrEqual(
        0.28,
      );
      expect(ridge.material.fragmentShader).not.toContain("fleckCell");
    }
  });
  it("presents broad painted faces tangent to the pond, with complete fog uniforms", () => {
    const horizon = createPaintedMountains(true);
    for (const ridge of horizon.children as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.ShaderMaterial
    >[]) {
      const along = new THREE.Vector3(1, 0, 0).applyEuler(ridge.rotation);
      const radial = ridge.position.clone().setY(0).normalize();
      expect(Math.abs(along.dot(radial))).toBeLessThan(0.001);
      expect(ridge.material.uniforms.fogColor).toBeDefined();
    }
  });

  it("returns a named horizon group of finite ridge meshes", () => {
    const horizon = createPaintedMountains(true);
    expect(horizon).toBeInstanceOf(THREE.Group);
    expect(horizon.name).toBe("karst horizon");
    expect(horizon.children.length).toBeGreaterThan(0);
    expect(
      horizon.children.every(
        (ridge) => ridge instanceof THREE.Mesh && ridge.name === "karst ridge",
      ),
    ).toBe(true);
    for (const ridge of horizon.children as THREE.Mesh[]) {
      const positions = ridge.geometry.getAttribute("position");
      expect(positions.count).toBeGreaterThan(0);
      for (let i = 0; i < positions.count; i++) {
        expect(
          Number.isFinite(
            positions.getX(i) + positions.getY(i) + positions.getZ(i),
          ),
        ).toBe(true);
      }
    }
  });

  it("layers painterly ridges around all eight horizon sectors", () => {
    const horizon = createPaintedMountains(true);
    const ridges = horizon.children as THREE.Mesh[];
    const sectors = new Set(
      ridges.map(({ position }) =>
        Math.floor(
          (Math.atan2(position.x, position.z) + Math.PI) / (Math.PI / 4),
        ),
      ),
    );
    const depthBands = new Set(
      ridges.map(({ position }) =>
        Math.round(Math.hypot(position.x, position.z) / 25),
      ),
    );
    expect(ridges.length).toBeGreaterThanOrEqual(30);
    expect(sectors.size).toBeGreaterThanOrEqual(8);
    expect(depthBands.size).toBeGreaterThanOrEqual(3);
    expect(
      ridges.every(
        ({ material }) =>
          material instanceof THREE.ShaderMaterial && material.fog,
      ),
    ).toBe(true);
  });

  it("keeps three atmospheric distances in low quality with fewer ridges", () => {
    const high = createPaintedMountains(true);
    const low = createPaintedMountains(false);
    expect(low.children.length).toBeLessThan(high.children.length);
    const lowBands = new Set(
      low.children.map(({ position }) =>
        Math.round(Math.hypot(position.x, position.z) / 25),
      ),
    );
    expect(lowBands.size).toBeGreaterThanOrEqual(3);
    expect(low.children.length).toBeGreaterThanOrEqual(20);
  });
});
