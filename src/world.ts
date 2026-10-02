import { createWaterSurface } from "./water";
import { createPaintedMountains } from "./landscape";
import * as THREE from "three";

export type WorldQuality = "low" | "high";
export type InteractiveKind = "lotus" | "lantern";
export interface InteractiveEntity {
  id: string;
  kind: InteractiveKind;
  object: THREE.Object3D;
  position: THREE.Vector3;
  response: number;
  hovered?: boolean;
}
export interface StillwaterWorld {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  interactive: InteractiveEntity[];
  setWaterPointer(point: THREE.Vector2 | null): void;
  setMountainOpening?(amount: number): void;
  update(elapsed: number, dt: number, reducedMotion: boolean): void;
  dispose(): void;
}

const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lotusColors = [0xf6dbe2, 0xeab3c7, 0xf4cbd3];

function makePadGeometry(): THREE.BufferGeometry {
  const positions: number[] = [0, 0, 0];
  const colors: number[] = [0.09, 0.17, 0.13];
  const indices: number[] = [];
  const segments = 56;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const d = Math.atan2(Math.sin(a), Math.cos(a));
    const notchAngle = Math.atan2(Math.sin(a), Math.cos(a));
    const notch = Math.abs(notchAngle) < 0.19;
    const angle = notch ? Math.sign(d || 1) * (0.19 + Math.abs(d) * 0.18) : a;
    const radius =
      1 +
      0.035 * Math.sin(a * 5 + 0.7) +
      0.022 * Math.sin(a * 9 + 1.8) +
      0.012 * Math.sin(a * 13);
    positions.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const shade = Math.sin(a * 3 + 0.9);
    colors.push(
      0.07 + 0.012 * shade,
      0.14 + 0.025 * shade,
      0.11 + 0.02 * shade,
    );
  }
  for (let i = 0; i < segments; i++)
    indices.push(0, i + 1, ((i + 1) % segments) + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePetalGeometry(
  length: number,
  width: number,
  curl: number,
  segments = 10,
): THREE.BufferGeometry {
  const positions: number[] = [],
    indices: number[] = [];
  const rows = 16;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const half =
      width *
      Math.pow(Math.sin(Math.PI * Math.pow(t, 0.83)), 0.76) *
      (0.72 + 0.28 * t);
    for (let col = 0; col <= segments; col++) {
      const u = (col / segments) * 2 - 1;
      const cupped = 0.09 * (1 - u * u) * Math.sin(Math.PI * t);
      const y = curl * t * t + cupped + 0.025 * u * u * t;
      positions.push(u * half, y, length * t);
      if (row < rows && col < segments) {
        const a = row * (segments + 1) + col,
          b = a + segments + 1;
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

function makeBloomGeometry(seed: number, scale = 1): THREE.BufferGeometry {
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const openedPositions: number[] = [],
    openedNormals: number[] = [];
  let offset = 0;
  [10, 9, 7].forEach((count, layer) => {
    const color = new THREE.Color(
      lotusColors[(layer + Math.floor(seed)) % lotusColors.length],
    );
    for (let i = 0; i < count; i++) {
      const petal = makePetalGeometry(
        (0.64 - layer * 0.11) * scale * (0.94 + 0.06 * Math.sin(i * 4 + seed)),
        (0.18 - layer * 0.021) * scale,
        0.16 + layer * 0.025,
      );
      const opened = petal.clone();
      const angle = (i / count) * Math.PI * 2 + layer * 0.33 + seed;
      petal.rotateX(-0.48 - layer * 0.13);
      petal.rotateY(angle);
      petal.translate(0, layer * 0.032, 0);
      opened.rotateX(-0.1 - layer * 0.11);
      opened.rotateY(angle);
      opened.translate(0, layer * 0.032, 0);
      petal.computeVertexNormals();
      opened.computeVertexNormals();
      const p = petal.getAttribute("position"),
        n = petal.getAttribute("normal");
      const op = opened.getAttribute("position"),
        on = opened.getAttribute("normal");
      for (let j = 0; j < p.count; j++) {
        positions.push(p.getX(j), p.getY(j), p.getZ(j));
        normals.push(n.getX(j), n.getY(j), n.getZ(j));
        openedPositions.push(op.getX(j), op.getY(j), op.getZ(j));
        openedNormals.push(on.getX(j), on.getY(j), on.getZ(j));
        const shade = 0.94 + Math.min(1, Math.max(0, p.getY(j))) * 0.08;
        colors.push(color.r * shade, color.g * shade, color.b * shade);
      }
      for (const index of petal.getIndex()!.array) indices.push(index + offset);
      offset += p.count;
      petal.dispose();
      opened.dispose();
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.morphAttributes.position = [
    new THREE.Float32BufferAttribute(openedPositions, 3),
  ];
  geometry.morphAttributes.normal = [
    new THREE.Float32BufferAttribute(openedNormals, 3),
  ];
  return geometry;
}

function createBloomMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.38,
    side: THREE.DoubleSide,
    emissive: 0x28141c,
    emissiveIntensity: 0.08,
  });
}

function createLotus(
  id: string,
  at: THREE.Vector3,
  seed: number,
  bloomMaterial: THREE.MeshStandardMaterial,
) {
  const root = new THREE.Group();
  root.position.copy(at);
  root.name = id;
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x345e51,
    roughness: 0.75,
  });
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.024, 0.34, 9),
    stemMaterial,
  );
  stem.position.y = 0.17;
  root.add(stem);
  const bloom = new THREE.Mesh(makeBloomGeometry(seed), bloomMaterial);
  bloom.name = "lotus bloom";
  bloom.position.y = 0.29;
  root.add(bloom);
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0xd5a45e,
    roughness: 0.65,
    emissive: 0x4c2d14,
    emissiveIntensity: 0.08,
  });
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    centerMat,
  );
  center.scale.set(1, 0.53, 1);
  center.position.y = 0.46;
  root.add(center);
  return {
    entity: {
      id,
      kind: "lotus" as const,
      object: root,
      position: at.clone(),
      response: 0,
    },
    bloom,
  };
}

function createPaperTexture(): THREE.DataTexture {
  const width = 48,
    height = 64,
    data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const vertical =
        0.94 +
        0.04 * Math.cos((y / height) * Math.PI * 2) +
        0.025 * Math.sin(x * 0.65 + y * 0.23);
      const ribShade =
        1 -
        0.08 *
          Math.pow(Math.max(0, Math.cos((x / width) * Math.PI * 2 * 8)), 18);
      const i = (y * width + x) * 4;
      data[i] = Math.round(255 * vertical * ribShade);
      data[i + 1] = Math.round(205 * vertical * ribShade);
      data[i + 2] = Math.round(137 * vertical * ribShade);
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createLantern(
  id: string,
  at: THREE.Vector3,
  paperTexture: THREE.Texture,
  glowMaterial: THREE.SpriteMaterial,
  scale = 1,
): InteractiveEntity {
  const root = new THREE.Group();
  root.position.copy(at);
  root.name = id;
  root.scale.setScalar(scale);
  const paper = new THREE.MeshStandardMaterial({
    map: paperTexture,
    color: 0xffffff,
    emissive: 0xf48733,
    emissiveIntensity: 0.72,
    roughness: 0.66,
    side: THREE.DoubleSide,
  });
  const halo = new THREE.Sprite(glowMaterial.clone());
  halo.position.set(0, 0.49, 0.18);
  halo.scale.set(2.4, 2.4, 1);
  halo.renderOrder = 2;
  root.add(halo);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.34, 28, 20), paper);
  shell.scale.set(0.79, 1.14, 0.79);
  shell.position.y = 0.49;
  root.add(shell);
  const ribMaterial = new THREE.MeshStandardMaterial({
    color: 0xa07952,
    roughness: 0.76,
  });
  for (let j = -5; j <= 5; j++) {
    const y = j * 0.062;
    const radius =
      0.34 * 0.79 * Math.sqrt(1 - (y / (0.34 * 1.14)) ** 2) + 0.002;
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.0045, 5, 32),
      ribMaterial,
    );
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.49 + y;
    root.add(rib);
  }
  const capGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.05, 16);
  const cap = new THREE.Mesh(capGeometry, ribMaterial);
  cap.position.y = 0.865;
  root.add(cap);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.015, 6, 28),
    ribMaterial,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.11;
  rim.scale.set(0.79, 0.79, 1);
  root.add(rim);
  const light = new THREE.PointLight(0xffb86a, 1.25, 4.4, 1.8);
  light.position.y = 0.49;
  root.add(light);
  const tassel = new THREE.Mesh(
    new THREE.ConeGeometry(0.026, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xc77848, roughness: 0.8 }),
  );
  tassel.position.y = -0.12;
  root.add(tassel);
  return {
    id,
    kind: "lantern" as const,
    object: root,
    position: at.clone(),
    response: 0,
  };
}

function createMistTexture(): THREE.DataTexture {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1,
        ny = (y / (size - 1)) * 2 - 1;
      const r = Math.sqrt(nx * nx * 0.72 + ny * ny * 1.35);
      const wisps =
        0.75 +
        0.13 * Math.sin(nx * 11 + ny * 4) +
        0.08 * Math.sin(ny * 13 - nx * 6);
      const alpha = Math.pow(Math.max(0, 1 - r), 2.3) * Math.max(0.35, wisps);
      const index = (y * size + x) * 4;
      data[index] = 192;
      data[index + 1] = 211;
      data[index + 2] = 223;
      data[index + 3] = Math.round(alpha * 255);
    }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createStars(high: boolean): THREE.Points {
  const positions: number[] = [],
    sizes: number[] = [],
    phases: number[] = [];
  const count = high ? 2400 : 1200;
  let seed = 0x51a7f1e;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const azimuth = random() * Math.PI * 2;
    // Uniform sky area, without crowding stars into rows or near the zenith.
    const elevation = Math.asin(0.09 + random() * 0.905);
    const r = 94,
      h = Math.cos(elevation) * r;
    positions.push(
      Math.sin(azimuth) * h,
      Math.sin(elevation) * r,
      -Math.cos(azimuth) * h,
    );
    sizes.push(
      random() < 1 / 31 ? 1.2 + random() * 0.4 : 0.35 + random() * 0.6,
    );
    phases.push(i * 1.71);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; attribute float aPhase; varying float vPhase; varying float vSize;
      void main(){vPhase=aPhase;vSize=aSize;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*320.0/-mv.z,1.0,6.0);}`,
    fragmentShader: `uniform float uTime;varying float vPhase;varying float vSize;
      void main(){vec2 p=gl_PointCoord-0.5;float halo=exp(-dot(p,p)*26.0);float alpha=halo*(0.72+0.08*sin(uTime*0.38+vPhase));
      vec3 color=mix(vec3(0.55,0.70,0.75),vec3(0.89,0.80,0.55),step(1.2,vSize));gl_FragColor=vec4(color,alpha);
      #include <colorspace_fragment>
      }`,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "quiet stars";
  return stars;
}

function createWorld(
  _renderer: THREE.WebGLRenderer,
  quality: WorldQuality,
): StillwaterWorld {
  const high = quality === "high";
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1830);
  scene.fog = new THREE.FogExp2(0x1a3041, high ? 0.0062 : 0.007);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 180);
  camera.position.set(0, 2.2, 12);
  camera.lookAt(0, 1.1, 0);
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader:
      "varying vec3 vP; void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec3 vP;
void main(){
  float h=normalize(vP).y;
  vec3 low=vec3(0.09,0.13,0.23);
  vec3 mid=vec3(0.03,0.055,0.12);
  vec3 top=vec3(0.008,0.016,0.045);
  vec3 c=mix(low,mid,smoothstep(-0.18,0.35,h));
  c=mix(c,top,smoothstep(0.25,0.88,h));
  float moon=pow(max(0.0,1.0-length(normalize(vP)-normalize(vec3(-0.35,0.42,-0.83)))),1400.0);
  c+=moon*vec3(0.55,0.57,0.58);
  gl_FragColor=vec4(c,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(160, 32, 24),
    skyMaterial,
  );
  sky.name = "blue hour sky";
  scene.add(sky);
  const stars = createStars(high);
  scene.add(stars);
  scene.add(new THREE.HemisphereLight(0xb6c8ed, 0x172a27, high ? 0.95 : 0.75));
  const moon = new THREE.DirectionalLight(0xb7cbed, high ? 1.3 : 0.9);
  moon.position.set(-12, 18, -10);
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x647995, 0.26));

  const waterSurface = createWaterSurface(high);
  const water = waterSurface.mesh;
  scene.add(water);
  const padsGeometry = makePadGeometry();
  const padsMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.015,
    side: THREE.DoubleSide,
  });
  const padCount = high ? 70 : 34;
  const pads = new THREE.InstancedMesh(padsGeometry, padsMaterial, padCount);
  pads.name = "water lily pads";
  pads.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < padCount; i++) {
    const cluster = Math.floor(i / 7),
      member = i % 7;
    const clusterAngle = cluster * 2.399963,
      clusterRadius = 3.5 + ((cluster * 13) % 9) * 1.75;
    const centerX = Math.cos(clusterAngle) * clusterRadius;
    const centerZ = Math.sin(clusterAngle) * clusterRadius * 0.72 + 1.5;
    const scatterAngle = member * 2.399963 + cluster * 1.1;
    const scatterRadius = 0.45 + ((i * 7) % 8) * 0.31;
    const x = centerX + Math.cos(scatterAngle) * scatterRadius;
    const z = centerZ + Math.sin(scatterAngle) * scatterRadius * 0.74;
    const s = 0.62 + ((i * 17) % 11) / 17;
    dummy.position.set(x, 0.034 + (i % 4) * 0.001, z);
    dummy.rotation.set(0, clusterAngle + member * 0.6, 0);
    dummy.scale.set(
      s * (0.9 + 0.15 * Math.sin(i)),
      1,
      s * (0.75 + 0.16 * Math.cos(i * 2)),
    );
    dummy.updateMatrix();
    pads.setMatrixAt(i, dummy.matrix);
  }
  pads.instanceMatrix.needsUpdate = true;
  scene.add(pads);

  const mountains = createPaintedMountains(high);
  scene.add(mountains);

  const mistTexture = createMistTexture();
  const passageMist = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: mistTexture,
      color: 0xbfe0d6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  passageMist.name = "mountain passage mist";
  passageMist.position.set(0, 4, -71);
  passageMist.scale.set(13, 19, 1);
  scene.add(passageMist);
  const lanternGlowMaterial = new THREE.SpriteMaterial({
    map: mistTexture,
    color: 0xffb064,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mistMaterial = new THREE.SpriteMaterial({
    map: mistTexture,
    color: 0xb8cad7,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const nearMistMaterial = new THREE.SpriteMaterial({
    map: mistTexture,
    color: 0xc8d5de,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const mists: THREE.Sprite[] = [];
  const mistCount = high ? 16 : 9;
  for (let i = 0; i < mistCount; i++) {
    const sprite = new THREE.Sprite(i < 4 ? nearMistMaterial : mistMaterial);
    if (i < 4) {
      sprite.position.set(
        -4.2 + i * 2.7,
        1.26 + (i % 2) * 0.1,
        -1.5 - (i % 3) * 2.2,
      );
      sprite.scale.set(4.4 + (i % 2) * 0.6, 0.95 + (i % 2) * 0.16, 1);
    } else {
      const angle = (i / mistCount) * Math.PI * 2;
      sprite.position.set(
        Math.sin(angle) * (11 + (i % 4) * 3),
        1.0 + (i % 3) * 0.18,
        -8 - (i % 5) * 4,
      );
      sprite.scale.set(7 + (i % 4) * 1.3, 1.6 + (i % 3) * 0.4, 1);
    }
    sprite.name = "feathered pond mist";
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    scene.add(sprite);
    mists.push(sprite);
  }

  const bloomMaterial = createBloomMaterial();
  const flowers = new THREE.Group();
  flowers.name = "pond lotus garden";
  scene.add(flowers);
  const entities: InteractiveEntity[] = [],
    lotuses: { entity: InteractiveEntity; bloom: THREE.Mesh }[] = [];
  const nearLotuses = [
    vec(-1.3, 0, 8),
    vec(-0.4, 0, 7),
    vec(1.55, 0, 6.9),
    vec(2.8, 0, 6.4),
  ];
  const foregroundCount = high ? 4 : 2;
  for (let i = 0; i < foregroundCount; i++) {
    const created = createLotus(
      `lotus-${i + 1}`,
      nearLotuses[i]!,
      i * 1.4,
      bloomMaterial,
    );
    entities.push(created.entity);
    lotuses.push(created);
    scene.add(created.entity.object);
  }
  const flowerCount = high ? 22 : 12;
  const flowerGeometryCache = new Map<number, THREE.BufferGeometry>();
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x315c50,
    roughness: 0.8,
  });
  for (let i = 0; i < flowerCount; i++) {
    const a = i * 2.399963,
      r = 5.7 + Math.sqrt(i / flowerCount) * 16;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.72 + 2.2;
    const size = 0.48 + (i % 5) * 0.055;
    const key = i % 4;
    if (!flowerGeometryCache.has(key))
      flowerGeometryCache.set(key, makeBloomGeometry(key * 1.3, size));
    const bloom = new THREE.Mesh(flowerGeometryCache.get(key)!, bloomMaterial);
    bloom.morphTargetInfluences![0] = 0.72;
    bloom.position.set(x, 0.4 + size * 0.34, z);
    bloom.rotation.y = a * 0.4;
    flowers.add(bloom);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, 0.38 + size * 0.1, 7),
      stemMat,
    );
    stem.position.set(x, 0.2, z);
    flowers.add(stem);
  }

  const paperTexture = createPaperTexture();
  const lantern = createLantern(
    "lantern-1",
    vec(1.8, 0.02, 7.8),
    paperTexture,
    lanternGlowMaterial,
    0.93,
  );
  entities.push(lantern);
  scene.add(lantern.object);
  const lantern2 = createLantern(
    "lantern-2",
    vec(-5.8, 0.02, -3.8),
    paperTexture,
    lanternGlowMaterial,
    0.66,
  );
  entities.push(lantern2);
  scene.add(lantern2.object);
  const skyLanterns = [
    vec(-4.8, 3.4, 2),
    vec(-0.8, 5.1, -7.5),
    vec(5.5, 2.8, -1.5),
    vec(9, 6.1, -12),
    vec(-9, 4.2, -15),
    vec(2.5, 6.8, -16),
  ];
  skyLanterns.slice(0, high ? 6 : 3).forEach((position, i) => {
    const entity = createLantern(
      `lantern-sky-${i + 1}`,
      position,
      paperTexture,
      lanternGlowMaterial,
      0.65 + (i % 3) * 0.13,
    );
    entity.object.name = "hovering paper lantern";
    entities.push(entity);
    scene.add(entity.object);
  });
  const responseLights: THREE.PointLight[] = [];
  const reflectionLight = new THREE.PointLight(0xf4aa75, 0.55, 5.3, 2);
  reflectionLight.position.set(1.8, 0.23, 7.8);
  scene.add(reflectionLight);
  responseLights.push(reflectionLight);

  let disposed = false;
  let motionTime = 0;
  const paperWarm = new THREE.Color(0xffffff),
    paperRed = new THREE.Color(0xf12f39);
  const emissiveWarm = new THREE.Color(0xf48733),
    emissiveRed = new THREE.Color(0xff1726);
  const glowWarm = new THREE.Color(0xffb064),
    glowRed = new THREE.Color(0xff2738);
  const lanternLight = (entity: InteractiveEntity) =>
    entity.object.children.find(
      (node) => node instanceof THREE.PointLight,
    ) as THREE.PointLight;
  return {
    scene,
    camera,
    interactive: entities,
    setWaterPointer(point) {
      waterSurface.setPointer(point);
    },
    setMountainOpening(amount) {
      const opening = THREE.MathUtils.clamp(amount, 0, 1);
      for (const ridge of mountains.children as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.ShaderMaterial
      >[]) {
        ridge.material.uniforms.uOpening.value = opening;
      }
      passageMist.material.opacity = opening * 0.6;
    },
    update(elapsed, dt, reducedMotion) {
      if (disposed) return;
      const delta = Math.max(0, dt),
        time = reducedMotion ? motionTime : (motionTime = elapsed);
      waterSurface.update(time, delta, reducedMotion);
      (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
      if (!reducedMotion) {
        mists.forEach((sprite, i) => {
          sprite.position.x =
            sprite.userData.baseX + Math.sin(time * 0.08 + i * 2.1) * 0.28;
          sprite.position.y =
            sprite.userData.baseY + Math.sin(time * 0.2 + i) * 0.035;
        });
      }
      for (const part of lotuses) {
        const response = THREE.MathUtils.clamp(part.entity.response, 0, 1);
        part.bloom.morphTargetInfluences![0] = THREE.MathUtils.damp(
          part.bloom.morphTargetInfluences![0],
          0.22 + response * 0.65,
          5.5,
          delta,
        );
        const openness = THREE.MathUtils.damp(
          part.bloom.scale.x,
          0.96 + response * 0.04,
          5.5,
          delta,
        );
        part.bloom.scale.set(openness, 1, openness);
        part.entity.object.rotation.y = reducedMotion
          ? part.entity.object.rotation.y
          : Math.sin(time * 0.16 + part.entity.position.x) * 0.025;
      }
      entities
        .filter((entity) => entity.kind === "lantern")
        .forEach((entity, i) => {
          const response = THREE.MathUtils.clamp(entity.response, 0, 1);
          if (!reducedMotion) {
            entity.object.position.y =
              entity.position.y +
              0.035 +
              Math.sin(time * 0.52 + i * 1.7) * 0.04;
            entity.object.rotation.z = Math.sin(time * 0.31 + i) * 0.025;
          }
          const light = lanternLight(entity);
          light.intensity = THREE.MathUtils.damp(
            light.intensity,
            1.2 + response * 2.15,
            3.2,
            delta,
          );
          const shell = entity.object.children.find(
            (node) =>
              node instanceof THREE.Mesh &&
              node.material instanceof THREE.MeshStandardMaterial,
          ) as THREE.Mesh;
          const material = shell.material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = THREE.MathUtils.damp(
            material.emissiveIntensity,
            0.7 + response * 0.45,
            3.2,
            delta,
          );
          const blend = 1 - Math.exp(-delta * 3.6);
          material.color.lerp(entity.hovered ? paperRed : paperWarm, blend);
          material.emissive.lerp(
            entity.hovered ? emissiveRed : emissiveWarm,
            blend,
          );
          light.color.lerp(entity.hovered ? glowRed : glowWarm, blend);
          const halo = entity.object.children.find(
            (node) => node instanceof THREE.Sprite,
          ) as THREE.Sprite;
          halo.material.color.lerp(entity.hovered ? glowRed : glowWarm, blend);
          halo.material.opacity = THREE.MathUtils.damp(
            halo.material.opacity,
            0.25 + response * 0.16,
            3.2,
            delta,
          );
        });
      responseLights.forEach((light, i) => {
        const response = THREE.MathUtils.clamp(
          entities.find((entity) => entity.kind === "lantern")?.response ?? 0,
          0,
          1,
        );
        if (!reducedMotion)
          light.intensity = THREE.MathUtils.damp(
            light.intensity,
            0.42 + response * 0.42 + Math.sin(time * 0.8 + i) * 0.025,
            2,
            delta,
          );
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      waterSurface.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((node) => {
        if (node === water) return;
        if (node instanceof THREE.Mesh || node instanceof THREE.Points) {
          geometries.add(node.geometry);
          const list = Array.isArray(node.material)
            ? node.material
            : [node.material];
          list.forEach((material) => {
            materials.add(material);
            Object.values(material).forEach((value) => {
              if (value instanceof THREE.Texture) textures.add(value);
            });
          });
        } else if (node instanceof THREE.Sprite) {
          materials.add(node.material);
          Object.values(node.material).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
        }
      });
      materials.add(lanternGlowMaterial);
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      textures.forEach((texture) => texture.dispose());
      scene.clear();
    },
  };
}

export { createWorld };
