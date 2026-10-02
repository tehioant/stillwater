import * as THREE from "three";
import { createWaterSurface } from "./water";
import type { StillwaterWorld, WorldQuality } from "./world";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeBank(seed: number, side: number, end: number, high: boolean) {
  const sections = high ? 42 : 24;
  const positions: number[] = [];
  const indices: number[] = [];
  const rand = random(seed);
  for (let i = 0; i <= sections; i++) {
    const t = i / sections;
    const z = 12 - t * end;
    const bend =
      Math.sin(t * 5.4 + side) * 0.42 + Math.sin(t * 11 + side) * 0.16;
    const inner = 1.65 + Math.sin(t * 9 + side) * 0.18 + rand() * 0.22;
    const outer = 5.1 + Math.sin(t * 6 + side * 2) * 0.65 + rand() * 0.5;
    const slope = Math.sin(t * 17 + side) * 0.16;
    positions.push(side * (inner + bend), -0.08 + slope, z);
    positions.push(
      side * (outer + bend),
      -0.35 + slope,
      z + Math.sin(t * 7) * 0.35,
    );
    if (i < sections) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeTrunk(seed: number, height: number, radius: number) {
  const rings = 7,
    sides = 7;
  const positions: number[] = [],
    indices: number[] = [];
  const rand = random(seed);
  const bendX = (rand() - 0.5) * 0.55,
    bendZ = (rand() - 0.5) * 0.5;
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const r = radius * (1 - t * 0.82) * (1 + Math.sin(t * 19 + seed) * 0.045);
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const flare = ring === 0 ? 1 + 0.26 * Math.sin(a * 3 + seed) : 1;
      positions.push(
        Math.cos(a) * r * flare + bendX * t + Math.sin(a * 3 + seed) * 0.035,
        height * t,
        Math.sin(a) * r * flare + bendZ * t,
      );
      if (ring < rings && i < sides) {
        const n = ring * (sides + 1) + i,
          next = n + sides + 1;
        indices.push(n, next, n + 1, n + 1, next, next + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCanopy(seed: number, size: number) {
  const geometry = new THREE.SphereGeometry(size, 12, 9);
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    const lobe =
      1 +
      0.09 * Math.sin(x * 2.7 + seed) * Math.cos(z * 3.1 - seed * 0.3) +
      0.045 * Math.sin(y * 6 + x * 2);
    position.setXYZ(i, x * lobe, y * lobe, z * lobe);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createFireflies(quality: WorldQuality) {
  const count = quality === "high" ? 112 : 44;
  const rand = random(0xf1ef1e);
  const base: number[] = [],
    phases: number[] = [],
    sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const z = 9 - rand() * 29;
    const t = (9 - z) / 29;
    const halfWidth = 2.5 + t * 1.9;
    base.push((rand() * 2 - 1) * halfWidth, 0.35 + rand() * 2.5, z);
    phases.push(rand() * Math.PI * 2, rand() * 1.5 + 0.4, rand() * 2.4 + 0.3);
    sizes.push(2.0 + rand() * 3.6);
  }
  const positions = new Float32Array(base);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    name: "mist-soft firefly halos",
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    vertexShader: `
      attribute vec3 aPhase;
      attribute float aSize;
      uniform float uTime;
      varying float vGlow;
      #include <fog_pars_vertex>
      void main(){
        vec3 p=position;
        float pulse=0.72+0.28*sin(uTime*aPhase.y+aPhase.x);

        vGlow=pulse;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);
        #include <fog_vertex>
        gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=aSize*pulse*(270.0/max(60.0,-mvPosition.z));
      }`,
    fragmentShader: `
      varying float vGlow;
      #include <fog_pars_fragment>
      void main(){
        vec2 p=gl_PointCoord-0.5;
        float r=length(p);
        float halo=exp(-r*r*27.0);
        float core=exp(-r*r*150.0);
        gl_FragColor=vec4(vec3(0.48,0.88,0.63)*(halo*0.55+core*1.7)*vGlow,halo*0.52*vGlow);
        #include <fog_fragment>
      }`,
    fog: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "fireflies";
  points.frustumCulled = false;
  const update = (time: number, reducedMotion: boolean) => {
    if (reducedMotion) return;
    material.uniforms.uTime.value = time;
    for (let i = 0; i < count; i++) {
      const phase = phases[i * 3]!,
        speed = phases[i * 3 + 1]!,
        radius = phases[i * 3 + 2]!;
      const attribute = geometry.attributes.position;
      attribute.setXYZ(
        i,
        base[i * 3]! + Math.sin(time * 0.31 + phase) * 0.15,
        base[i * 3 + 1]! + Math.sin(time * radius + phase) * 0.13,
        base[i * 3 + 2]! + Math.sin(time * speed + phase) * 0.08,
      );
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return { points, update };
}

function createQuietStars(quality: WorldQuality) {
  const count = quality === "high" ? 2400 : 1200;
  const rand = random(0x570a5);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const azimuth = rand() * Math.PI * 2;
    const elevation = 0.045 + rand() * 0.78;
    const radius = 22 + rand() * 4;
    positions[i * 3] = Math.sin(azimuth) * Math.cos(elevation) * radius;
    positions[i * 3 + 1] = 10 + Math.sin(elevation) * radius;
    positions[i * 3 + 2] = -Math.cos(azimuth) * Math.cos(elevation) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xc1d8e8,
    size: 0.12,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "quiet stars";
  stars.frustumCulled = false;
  return stars;
}

export function createForest(
  renderer: THREE.WebGLRenderer,
  quality: WorldQuality,
): StillwaterWorld {
  void renderer;
  const high = quality === "high";
  const scene = new THREE.Scene();
  scene.name = "Moonlit forest glade";
  scene.background = new THREE.Color(0x091522);
  scene.fog = new THREE.FogExp2(0x12242d, 0.021);
  scene.add(new THREE.HemisphereLight(0x9bb9d5, 0x101b18, 1.45));
  scene.add(new THREE.AmbientLight(0x9fb3a6, 0.85));
  const moonlight = new THREE.DirectionalLight(0xc3d8ef, 2.1);
  moonlight.position.set(-7, 12, -9);
  scene.add(moonlight);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xd7e6ed }),
  );
  moon.name = "glade moon";
  moon.position.set(-2.5, 10, -25);
  scene.add(moon);

  const backdrop = new THREE.Group();
  backdrop.name = "moonlit glade backdrop";
  const farRand = random(301);
  for (let i = 0; i < (high ? 15 : 10); i++) {
    const x = -22 + farRand() * 44,
      z = -19 - farRand() * 6;
    const h = 7 + farRand() * 8;
    const trunk = new THREE.Mesh(
      makeTrunk(i + 80, h, 0.28 + farRand() * 0.23),
      new THREE.MeshStandardMaterial({ color: 0x17252a, roughness: 1 }),
    );
    trunk.position.set(x, 0, z);
    backdrop.add(trunk);
  }
  scene.add(backdrop);

  const banks = new THREE.Group();
  banks.name = "moss banks";
  for (const side of [-1, 1]) {
    const bank = new THREE.Mesh(
      makeBank(side < 0 ? 61 : 62, side, 36, high),
      new THREE.MeshStandardMaterial({
        color: side < 0 ? 0x263e32 : 0x304838,
        roughness: 0.96,
        flatShading: true,
      }),
    );
    bank.name = side < 0 ? "west moss bank" : "east moss bank";
    bank.receiveShadow = true;
    banks.add(bank);
  }
  scene.add(banks);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({ color: 0x182f28, roughness: 1 }),
  );
  ground.name = "glade floor";
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.38, -2);
  scene.add(ground);

  const waterSurface = createWaterSurface(high);
  waterSurface.mesh.scale.set(1, 1, 1);
  waterSurface.mesh.geometry.scale(0.019, 0.116, 1);
  waterSurface.mesh.position.set(0, -0.04, -5.2);
  waterSurface.mesh.name = "rippled reflective water";
  const channel = new THREE.Group();
  channel.name = "stream channel";
  channel.add(waterSurface.mesh);
  scene.add(channel);

  const forest = new THREE.Group();
  forest.name = "irregular old-growth grove";
  const treeRand = random(0x51a7e);
  const treeCount = high ? 20 : 13;
  for (let i = 0; i < treeCount; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 10 - treeRand() * 28;
    const t = (10 - z) / 38;
    const x = side * (3.8 + treeRand() * 4 + t * 2.5);
    const height = 6 + treeRand() * 4.8;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = (treeRand() - 0.5) * 0.8;
    const bark = new THREE.MeshStandardMaterial({
      color: i % 3 === 0 ? 0x554b3e : 0x38443b,
      roughness: 0.94,
      flatShading: true,
    });
    const trunk = new THREE.Mesh(
      makeTrunk(i + 1, height, 0.32 + treeRand() * 0.2),
      bark,
    );
    trunk.castShadow = true;
    group.add(trunk);
    const foliage = new THREE.MeshStandardMaterial({
      color: [0x183b37, 0x21443d, 0x2d4c42][i % 3],
      roughness: 1,
      flatShading: true,
    });
    const crown = new THREE.Mesh(
      makeCanopy(i * 1.31, 1.9 + treeRand() * 1.5),
      foliage,
    );
    crown.position.set(
      Math.sin(i * 2.8) * 0.6,
      height * 0.77,
      Math.cos(i * 1.7) * 0.45,
    );
    crown.scale.set(1.1, 0.82, 0.95);
    crown.castShadow = true;
    group.add(crown);
    forest.add(group);
  }
  scene.add(forest);

  const stones = new THREE.Group();
  stones.name = "stream stones";
  const stoneRand = random(9402);
  for (let i = 0; i < (high ? 28 : 17); i++) {
    const z = 11 - stoneRand() * 33;
    const side = i % 2 ? 1 : -1;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22 + stoneRand() * 0.52, 1),
      new THREE.MeshStandardMaterial({
        color: [0x53605d, 0x3e514c, 0x66716a][i % 3],
        roughness: 0.9,
        flatShading: true,
      }),
    );
    stone.position.set(
      side * (1.8 + stoneRand() * 1.4),
      -0.09 + stoneRand() * 0.16,
      z,
    );
    stone.rotation.set(stoneRand(), stoneRand() * 3, stoneRand());
    stone.scale.y = 0.45 + stoneRand() * 0.5;
    stone.castShadow = true;
    stones.add(stone);
  }
  scene.add(stones);

  const arch = new THREE.Group();
  arch.name = "returning passage • mist arch";
  arch.position.set(0, 0, 18);
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x43514f,
    roughness: 0.96,
    flatShading: true,
  });
  const left = new THREE.Mesh(new THREE.IcosahedronGeometry(1.65, 1), archMat);
  left.position.set(-2.25, 1.1, 0);
  left.scale.set(0.8, 1.5, 0.9);
  const right = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 1), archMat);
  right.position.set(2.25, 1.1, 0);
  right.scale.set(0.78, 1.55, 0.85);
  const lintel = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), archMat);
  lintel.position.set(0, 3.1, 0);
  lintel.scale.set(1.3, 0.48, 0.85);
  arch.add(left, right, lintel);
  scene.add(arch);

  const fireflyField = createFireflies(quality);
  scene.add(fireflyField.points);
  scene.add(createQuietStars(quality));
  const camera = new THREE.PerspectiveCamera(63, 1, 0.1, 140);
  camera.position.set(0, 2.2, 12);
  camera.lookAt(0, 1.15, 0);
  let disposed = false;
  const owned = new Set<THREE.BufferGeometry | THREE.Material>();
  scene.traverse((object) => {
    if (object === waterSurface.mesh) return;
    const resource = object as THREE.Mesh;
    if (resource.geometry) owned.add(resource.geometry);
    if (Array.isArray(resource.material))
      resource.material.forEach((material) => owned.add(material));
    else if (resource.material) owned.add(resource.material);
  });
  return {
    scene,
    camera,
    interactive: [],
    setWaterPointer(point) {
      waterSurface.setPointer(point);
    },
    update(elapsed, dt, reducedMotion) {
      if (disposed) return;
      fireflyField.update(elapsed, reducedMotion);
      waterSurface.update(elapsed, dt, reducedMotion);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      waterSurface.dispose();
      for (const resource of owned) resource.dispose();
      scene.clear();
    },
  };
}
