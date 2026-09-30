import * as THREE from "three";

const vertexShader = `
varying vec3 vLocal;
varying float vFogDepth;
void main() {
  vLocal = position;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `
uniform vec3 uInk;
uniform vec3 uJade;
uniform vec3 uLight;
uniform vec3 uGold;
uniform float uDistance;
varying vec3 vLocal;
#include <fog_pars_fragment>

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float grain = noise2(vLocal.xy * 2.7 + vec2(vLocal.z * 0.8, vLocal.y * 0.5));
  float tooth = noise2(vLocal.xy * 13.0 + vLocal.zy * 4.0);
  float brush = noise2(vec2(vLocal.x * 0.62 + grain * 1.4, vLocal.y * 1.8));
  float wash = smoothstep(0.18, 0.88, brush * 0.75 + grain * 0.25);
  vec3 color = mix(uInk, uJade, wash * 0.78 + 0.08);
  color = mix(color, uLight, smoothstep(0.54, 0.9, grain) * 0.3);

  // Broken, slanted mineral seams catch a cool blue-hour rim across the cliff face.
  float strata = sin(vLocal.y * 4.7 + vLocal.x * 0.31 + grain * 2.0);
  float seam = smoothstep(0.91, 0.995, strata) * smoothstep(0.22, 0.64, tooth);
  color = mix(color, uLight, seam * 0.34);
  float inkWash = smoothstep(0.77, 0.96, noise2(vLocal.xy * 1.9 + vec2(vLocal.z, -vLocal.x)));
  color *= 1.0 - inkWash * 0.24;

  // Sparse ochre flecks, like dry-brushed mineral pigment rather than a glitter layer.
  vec2 fleckCell = floor(vec2(vLocal.x * 5.0 + vLocal.y * 1.4, vLocal.y * 7.0));
  float fleck = step(0.991, hash21(fleckCell)) * smoothstep(0.18, 0.75, grain);
  color = mix(color, uGold, fleck * 0.72);
  float distanceWash = smoothstep(48.0, 145.0, uDistance);
  color = mix(color, uLight * 0.78 + uJade * 0.22, distanceWash * 0.3);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

interface RidgeLayer {
  count: number;
  radius: number;
  radiusSpread: number;
  height: number;
  heightSpread: number;
  width: number;
  depth: number;
  colors: [number, number, number];
}

const layers: RidgeLayer[] = [
  {
    count: 10,
    radius: 69,
    radiusSpread: 11,
    height: 18,
    heightSpread: 7,
    width: 50,
    depth: 3.8,
    colors: [0x173d35, 0x286352, 0x81ad8d],
  },
  {
    count: 11,
    radius: 101,
    radiusSpread: 13,
    height: 23,
    heightSpread: 9,
    width: 61,
    depth: 2.2,
    colors: [0x254d48, 0x39766b, 0x91bdb0],
  },
  {
    count: 12,
    radius: 133,
    radiusSpread: 13,
    height: 28,
    heightSpread: 10,
    width: 76,
    depth: 0.6,
    colors: [0x385c60, 0x587f7d, 0xa3c1b8],
  },
];

function ridgeGeometry(
  seed: number,
  width: number,
  height: number,
): THREE.BufferGeometry {
  const columns = 64;
  const rows = 18;
  const positions: number[] = [];
  const indices: number[] = [];
  const phase = seed * 1.713;
  const peaks = 2 + (seed % 3);
  const centers = Array.from(
    { length: peaks },
    (_, i) =>
      -0.77 + (i + 0.5) * (1.54 / peaks) + Math.sin(seed * 2.1 + i * 5.3) * 0.1,
  );
  const heights = centers.map(
    (_, i) => 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(phase + i * 2.7)),
  );
  const widths = centers.map(
    (_, i) => 0.11 + 0.07 * (0.5 + 0.5 * Math.cos(phase * 0.7 + i * 3.2)),
  );
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = (col / columns) * 2 - 1;
      let crest = 0.12;
      for (let p = 0; p < peaks; p++) {
        const offset = (u - centers[p]!) / widths[p]!;
        const asym = offset < 0 ? 0.78 : 1.14;
        crest = Math.max(
          crest,
          heights[p]! * Math.exp(-offset * offset * asym),
        );
      }
      const shoulder =
        0.06 * Math.sin(u * 17 + phase) +
        0.035 * Math.sin(u * 31 - phase * 1.8);
      const silhouette =
        Math.max(0.055, crest + shoulder) *
        Math.pow(Math.max(0, 1 - u * u), 0.22);
      const ridgeY = height * silhouette;
      const cut =
        Math.sin(u * 21 + phase) * Math.sin(t * 11 + phase * 0.6) * 0.13 +
        Math.sin(u * 49 - t * 17 + phase) * 0.045;
      const y = 0.08 + ridgeY * t + cut * t * (1 - t * 0.4);
      const z =
        -t * (1.5 + silhouette * 2.8) + Math.sin(u * 13 + phase) * t * 0.22;
      positions.push(u * width * 0.5, y, z);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
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

function ridgeMaterial(
  colors: [number, number, number],
  distance: number,
): THREE.ShaderMaterial {
  const color = (hex: number) => new THREE.Color(hex);
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uInk: { value: color(colors[0]) },
        uJade: { value: color(colors[1]) },
        uLight: { value: color(colors[2]) },
        uGold: { value: color(0xd5ad69) },
        uDistance: { value: distance },
      },
    ]),
    vertexShader,
    fragmentShader,
    fog: true,
    side: THREE.DoubleSide,
  });
}

/** Creates a procedural, painterly ring of layered jade-and-ink karst ridges. */
export function createPaintedMountains(high: boolean): THREE.Group {
  const horizon = new THREE.Group();
  horizon.name = "karst horizon";
  let seed = 1;
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex]!;
    const count = high ? layer.count : Math.max(8, layer.count - 3);
    for (let i = 0; i < count; i++) {
      const angle =
        (i / count) * Math.PI * 2 +
        Math.sin(i * 3.7 + layerIndex) * 0.045 +
        layerIndex * 0.11;
      const radius =
        layer.radius +
        Math.sin(i * 8.17 + layerIndex * 2.4) * layer.radiusSpread * 0.5;
      const height =
        layer.height +
        Math.sin(i * 4.31 + layerIndex) * layer.heightSpread * 0.5;
      const width =
        layer.width + Math.cos(i * 6.1 + layerIndex * 0.7) * layer.width * 0.15;
      const ridge = new THREE.Mesh(
        ridgeGeometry(seed, width, height),
        ridgeMaterial(layer.colors, radius),
      );
      ridge.position.set(
        Math.sin(angle) * radius,
        -0.16,
        -Math.cos(angle) * radius,
      );
      ridge.rotation.y = -angle;
      ridge.name = "karst ridge";
      horizon.add(ridge);
      seed++;
    }
  }
  return horizon;
}
