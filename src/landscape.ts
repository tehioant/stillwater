import * as THREE from "three";

const vertexShader = `
attribute float aCrest;
varying vec3 vLocal;
varying float vCrest;
varying float vFogDepth;
void main() {
  vLocal = position;
  vCrest = aCrest;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vFogDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}`;

const fragmentShader = `
uniform vec3 uInk;
uniform vec3 uJade;
uniform vec3 uLight;
uniform vec3 uContourColor;
uniform float uContourOpacity;
uniform float uPhase;
uniform float uLayer;
uniform float uWidth;
varying vec3 vLocal;
varying float vCrest;
#include <fog_pars_fragment>

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float profile = clamp(vLocal.y / max(vCrest, 0.1), 0.0, 1.0);
  // Broad ink washes, not mottled rock noise: texture stays subordinate to shape.
  float wash = 0.5 + 0.5 * sin(vLocal.x * 0.095 + uPhase + profile * 1.8);
  vec3 color = mix(uInk, uJade, 0.24 + wash * 0.36);
  color = mix(color, uLight, smoothstep(0.15, 1.0, profile) * 0.22);
  float grain = noise2(vLocal.xy * 6.0) - 0.5;
  color *= 1.0 + grain * 0.025;

  // Fine parallel contour ribbons follow each actual crest, like woodblock linework.
  float band = profile * (6.0 - uLayer) + sin(vLocal.x * 0.10 + uPhase) * 0.08;
  float edge = abs(fract(band + 0.5) - 0.5);
  float aa = max(fwidth(band), 0.001);
  float line = 1.0 - smoothstep(aa * 0.28, aa * 1.25, edge);
  float endFade = 1.0 - smoothstep(0.60, 0.93, abs(vLocal.x) * 2.0 / uWidth);
  float restraint = smoothstep(0.12, 0.3, profile) * (1.0 - smoothstep(0.90, 1.0, profile)) * endFade;
  color = mix(color, uContourColor, line * restraint * uContourOpacity);
  float crestEdge = (1.0 - smoothstep(0.0, max(fwidth(profile) * 1.1, 0.002), 1.0 - profile));
  color = mix(color, uContourColor, crestEdge * uContourOpacity * 0.7);
  // A soft low wash separates overlapping hills without opaque cloud-shaped blobs.
  color = mix(color, uLight, (1.0 - smoothstep(0.02, 0.24, profile)) * 0.16);
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
  colors: [number, number, number];
}

const layers: RidgeLayer[] = [
  {
    count: 10,
    radius: 69,
    radiusSpread: 10,
    height: 15,
    heightSpread: 6,
    width: 58,
    colors: [0x162b3c, 0x23584e, 0x5c8885],
  },
  {
    count: 11,
    radius: 101,
    radiusSpread: 12,
    height: 23,
    heightSpread: 8,
    width: 70,
    colors: [0x294752, 0x396e68, 0x71968f],
  },
  {
    count: 12,
    radius: 133,
    radiusSpread: 12,
    height: 29,
    heightSpread: 9,
    width: 83,
    colors: [0x455f75, 0x628283, 0x8fa8a8],
  },
];

function ridgeGeometry(
  seed: number,
  width: number,
  height: number,
  high: boolean,
): THREE.BufferGeometry {
  const columns = high ? 128 : 80;
  const rows = 8;
  const positions: number[] = [],
    crests: number[] = [],
    indices: number[] = [];
  const phase = seed * 1.713;
  const peaks = 2 + (seed % 2);
  const centers = Array.from(
    { length: peaks },
    (_, i) =>
      -0.66 +
      (i + 0.5) * (1.32 / peaks) +
      Math.sin(seed * 2.1 + i * 5.3) * 0.13,
  );
  const heights = centers.map(
    (_, i) => 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(phase + i * 2.7)),
  );
  const widths = centers.map(
    (_, i) => 0.23 + 0.17 * (0.5 + 0.5 * Math.cos(phase * 0.7 + i * 3.2)),
  );
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let col = 0; col <= columns; col++) {
      const u = (col / columns) * 2 - 1;
      let crest = 0.09;
      for (let p = 0; p < peaks; p++) {
        const offset = (u - centers[p]!) / widths[p]!;
        const asym = offset < 0 ? 0.7 : 1.18;
        // Occasional steeper far peaks, with predominantly long rounded shoulders.
        const power = seed % 7 === 0 ? 1.35 : 2.4;
        crest +=
          heights[p]! *
          Math.exp(-Math.pow(Math.abs(offset), power) * asym) *
          0.78;
      }
      const taper = Math.pow(Math.max(0, 1 - u * u), 0.28);
      const ridgeY = height * crest * taper;
      const crestY = 0.08 + ridgeY;
      const y = 0.08 + ridgeY * t;
      const z = -t * (1.1 + crest * 2.4) + Math.sin(u * 5.0 + phase) * t * 0.32;
      positions.push(u * width * 0.5, y, z);
      crests.push(crestY);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col,
          b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("aCrest", new THREE.Float32BufferAttribute(crests, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ridgeMaterial(
  colors: [number, number, number],
  seed: number,
  layer: number,
  width: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uInk: { value: new THREE.Color(colors[0]) },
        uJade: { value: new THREE.Color(colors[1]) },
        uLight: { value: new THREE.Color(colors[2]) },
        uContourColor: { value: new THREE.Color(0xe0cba6) },
        uContourOpacity: { value: 0.24 - layer * 0.055 },
        uPhase: { value: seed * 1.713 },
        uLayer: { value: layer },
        uWidth: { value: width },
      },
    ]),
    vertexShader,
    fragmentShader,
    fog: true,
    side: THREE.DoubleSide,
  });
}

/** Original flowing contour landscape inspired by layered printmaking, adapted to blue hour. */
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
        ridgeGeometry(seed, width, height, high),
        ridgeMaterial(layer.colors, seed, layerIndex, width),
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
