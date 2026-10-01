import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

export function createWaterSurface(high: boolean) {
  const rippleCount = high ? 12 : 8;
  const shader = {
    name: "Stillwater reflective pond",
    uniforms: {
      color: { value: new THREE.Color(0x163d3b) },
      tDiffuse: { value: null },
      textureMatrix: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uFlow: { value: new THREE.Vector2() },
      uPointer: { value: new THREE.Vector2() },
      uPointerStrength: { value: 0 },
      uRipples: {
        value: Array.from(
          { length: rippleCount },
          () => new THREE.Vector4(0, 0, 0, 0),
        ),
      },
    },
    vertexShader: `
   uniform mat4 textureMatrix;
   varying vec4 vReflection;
   varying vec3 vWorld;
   void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vReflection = textureMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
  `,
    fragmentShader: `
   uniform sampler2D tDiffuse;
   uniform float uTime;
   uniform vec2 uFlow;
   uniform vec2 uPointer;
   uniform float uPointerStrength;
   uniform vec4 uRipples[${rippleCount}];
   varying vec4 vReflection;
   varying vec3 vWorld;
   void main() {
    vec2 p = vWorld.xz + uFlow;
    float t = uTime * 0.18;
    vec2 ripple = vec2(
     sin(p.x*0.73+p.y*0.42+t)*0.40 + sin(p.x*1.89-p.y*0.94-t*1.27)*0.13 + sin(p.x*4.3+p.y*1.25+t*1.9)*0.045,
     cos(p.x*0.31-p.y*0.79-t*0.83)*0.38 + cos(p.x*1.12+p.y*1.61+t*1.34)*0.12 + cos(p.y*3.9-p.x*1.13-t*1.8)*0.045
    );
    vec2 waveSlope = vec2(0.0);
    float waveLight = 0.0;
    for (int i = 0; i < ${rippleCount}; i++) {
      vec4 wave = uRipples[i];
      vec2 offset = vWorld.xz-wave.xy;
      float radius = length(offset);
      float front = radius-wave.z*2.4;
      float envelope = exp(-front*front*1.1-wave.z*0.85)*wave.w/(1.0+radius*0.22);
      float phase = front*5.2;
      float slope = (5.2*cos(phase)-2.2*front*sin(phase))*envelope;
      waveSlope += offset/max(radius,0.08)*slope*0.12;
      waveLight += max(0.0,sin(phase))*envelope;
    }
    vec3 normal = normalize(vec3(ripple.x*0.067+waveSlope.x,1.0,ripple.y*0.067+waveSlope.y));
    vec3 view = normalize(cameraPosition-vWorld);
    float facing = clamp(dot(normal,view),0.0,1.0);
    float fresnel = 0.34 + 0.54*pow(1.0-facing,3.0);
    vec2 uv = vReflection.xy/vReflection.w;
    float distant = smoothstep(8.0,70.0,length(cameraPosition.xz-vWorld.xz));
    uv += ripple*mix(0.0065,0.0018,distant);
    uv += waveSlope*mix(0.028,0.007,distant);
    uv = clamp(uv, vec2(0.001), vec2(0.999));
    vec3 reflected = texture2D(tDiffuse,uv).rgb;
    vec3 deep = vec3(0.011,0.039,0.038);
    vec3 jade = vec3(0.027,0.074,0.068);
    float wash = 0.5+0.5*sin(p.y*0.28+p.x*0.13+t*0.38);
    vec3 color = mix(deep,jade,wash*0.38);
    color = mix(color,reflected*vec3(0.78,0.91,0.91),fresnel);
    vec3 moon = normalize(vec3(-0.4,0.7,-0.55));
    float shimmer = pow(max(dot(reflect(-moon,normal),view),0.0),130.0);
    color += vec3(0.38,0.44,0.38)*shimmer*0.15;
    color += vec3(0.065,0.12,0.115)*waveLight;
    float tiny = sin(p.x*10.2+p.y*7.1+t)*sin(p.y*12.4-p.x*5.3-t*1.3);
    color += vec3(0.015,0.025,0.023)*tiny*0.07;
    gl_FragColor = vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }
  `,
  };
  const mesh = new Reflector(new THREE.PlaneGeometry(300, 300), {
    textureWidth: high ? 640 : 320,
    textureHeight: high ? 640 : 320,
    clipBias: 0.003,
    multisample: 0,
    shader,
  });
  mesh.name = "rippled reflective water";
  mesh.rotation.x = -Math.PI / 2;
  mesh.frustumCulled = false;
  const material = mesh.material as THREE.ShaderMaterial;
  let disposed = false;
  const pointerTarget = new THREE.Vector2();
  const flowTarget = new THREE.Vector2();
  let pointerActive = false;
  let firstPointer = true;
  const ripples = material.uniforms.uRipples.value as THREE.Vector4[];
  let nextRipple = 0;
  let lastRipplePoint: THREE.Vector2 | null = null;
  return {
    mesh,
    setPointer(point: THREE.Vector2 | null) {
      pointerActive = point !== null;
      if (point) {
        pointerTarget.copy(point);
        flowTarget.set(
          THREE.MathUtils.clamp(point.x * 0.075, -2, 2),
          THREE.MathUtils.clamp(point.y * 0.075, -2, 2),
        );
        if (firstPointer) {
          material.uniforms.uPointer.value.copy(point);
          firstPointer = false;
        }
      } else {
        flowTarget.set(0, 0);
        lastRipplePoint = null;
      }
    },
    update(time: number, dt: number, reducedMotion: boolean) {
      if (disposed || reducedMotion) return;
      const delta = THREE.MathUtils.clamp(dt, 0, 0.05);
      const waveDelta = THREE.MathUtils.clamp(dt, 0, 0.25);
      for (const wave of ripples) {
        if (wave.w <= 0) continue;
        wave.z += waveDelta;
        if (wave.z >= 6) wave.w = 0;
      }
      if (pointerActive) {
        const distance = lastRipplePoint?.distanceTo(pointerTarget) ?? 0;
        if (!lastRipplePoint || distance >= 0.35) {
          const samples = lastRipplePoint
            ? Math.min(3, Math.ceil(distance / 0.7))
            : 1;
          const origin = lastRipplePoint ?? pointerTarget;
          for (let i = 1; i <= samples; i++) {
            const blend = i / samples;
            ripples[nextRipple].set(
              THREE.MathUtils.lerp(origin.x, pointerTarget.x, blend),
              THREE.MathUtils.lerp(origin.y, pointerTarget.y, blend),
              0,
              THREE.MathUtils.clamp(0.7 + distance * 0.12, 0.7, 1.2),
            );
            nextRipple = (nextRipple + 1) % rippleCount;
          }
          if (!lastRipplePoint) lastRipplePoint = new THREE.Vector2();
          lastRipplePoint.copy(pointerTarget);
        }
      }
      material.uniforms.uTime.value = time;
      material.uniforms.uFlow.value.lerp(
        flowTarget,
        1 - Math.exp(-delta * 2.2),
      );
      material.uniforms.uPointer.value.lerp(
        pointerTarget,
        1 - Math.exp(-delta * 5),
      );
      material.uniforms.uPointerStrength.value = THREE.MathUtils.damp(
        material.uniforms.uPointerStrength.value,
        pointerActive ? 1 : 0,
        4,
        delta,
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.dispose();
      mesh.geometry.dispose();
    },
  };
}
