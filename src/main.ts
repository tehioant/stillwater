import "./style.css";
import * as THREE from "three";
import { createWorld } from "./world";
import {
  initialNavigation,
  advanceNavigation,
  pointerNavigation,
} from "./navigation";
import { interactionTarget } from "./interaction";
import { createAmbience } from "./audio";

const lotus = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 31C9 23 15 11 20 6c5 5 11 17 0 25Z"/><path d="M20 31C9 32 4 22 5 16c8 0 13 6 15 15Zm0 0c11 1 16-9 15-15-8 0-13 6-15 15ZM7 33c8 4 18 4 26 0"/></svg>`;
const icons = {
  sound:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Zm4 3c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>',
  motion:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8c3-5 5 5 9 0s6 5 9 0M3 16c3-5 5 5 9 0s6 5 9 0"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.5"/></svg>',
};
document.querySelector("#app")!.innerHTML = `
 <section id="experience" aria-label="Interactive blue-hour pond" data-ready="false">
  <div id="scene"></div><div class="vignette" aria-hidden="true"></div>
  <header class="masthead"><a class="wordmark" href="./" aria-label="Stillwater home">${lotus}<span>STILLWATER</span></a><span class="hour"><i></i> BLUE HOUR</span></header>
  <section id="welcome" aria-labelledby="title">
   <span class="eyebrow">A QUIET PLACE TO WANDER</span>
   <h1 id="title">Stillwater</h1>
   <p>Let the world slow down.<br>There is nowhere you need to be.</p>
   <button id="enter" class="enter" disabled>Preparing the pond…</button>
   <span class="welcome-note">Move gently. Stay a while.</span>
  </section>
  <div id="after-entry" hidden><div class="scene-caption"><span class="eyebrow">THE LOTUS POND</span><p>Some things open<br>when you come closer.</p></div><p id="hint" class="hint">Mouse to steer <span>·</span> centre to rest <span>·</span> hover to discover</p></div>
  <footer class="bottom-bar"><span class="footer-note">A moment, just for you.</span><nav aria-label="Pond controls">
   <button id="sound" aria-label="Enable ambient sound" aria-pressed="false" title="Ambient sound">${icons.sound}<span>Sound off</span></button>
   <button id="motion" aria-label="Reduce motion" aria-pressed="false" title="Reduce motion">${icons.motion}<span>Motion</span></button>
   <button id="reset" aria-label="Reset view" title="Reset view">${icons.reset}</button>
   <button id="help" aria-label="How to explore" title="How to explore">${icons.help}</button>
  </nav></footer>
  <div id="touch-controls" hidden aria-label="Glide controls"><button data-forward="1" aria-label="Glide forward">↑</button><div><button data-right="-1" aria-label="Glide left">←</button><button data-forward="-1" aria-label="Glide backward">↓</button><button data-right="1" aria-label="Glide right">→</button></div></div>
  <div id="hover-label" aria-hidden="true"></div><p id="notice" role="status" aria-live="polite"></p>
  <dialog id="guide" aria-labelledby="guide-title"><button id="close-guide" aria-label="Close guide">×</button><span class="eyebrow">TAKE YOUR TIME</span><h2 id="guide-title">A little wayfinding</h2><p><b>Steer with your mouse</b> — no click or hold needed.<br>Move toward the top or bottom to glide forward or back; left or right to turn.<br><b>Rest</b> in the centre to slow to a stop.<br>WASD / arrows and click-drag look also work.<br><b>Pause over a lotus</b> nearby to see it unfold.<br><b>Approach a lantern</b> to warm its light.</p><p class="guide-secondary">On touch screens, drag to look, use the arrows to glide, and tap a flower or lantern. Sound is optional. Motion can be paused anytime.</p><button id="continue" class="enter">Back to the pond</button></dialog>
 </section>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const container = $("scene");
const enter = $<HTMLButtonElement>("enter");
const guide = $<HTMLDialogElement>("guide");
const mediaMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mediaTouch = window.matchMedia("(pointer: coarse)");
let reducedMotion = mediaMotion.matches;
let entered = false;
let soundEnabled = false;
let active = true;
let disposed = false;
let graphicsLost = false;
const ambience = createAmbience();
const keys = new Set<string>();
const touchMovement = { forward: 0, right: 0 };
const navigation = initialNavigation();
const pointer = new THREE.Vector2(-10, -10);
const raycaster = new THREE.Raycaster();
let tappedId: string | null = null;
let tapRemaining = 0;
let mouseSteering = false;
let dragged = false;
let dragging: { x: number; y: number; id: number } | null = null;
let elapsed = 0;
let animationId = 0;
let noticeTimer = 0;
const inform = (text: string) => {
  $("notice").textContent = text;
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    $("notice").textContent = "";
  }, 4500);
};
function syncMotion() {
  $("motion").setAttribute("aria-pressed", String(reducedMotion));
  $("motion").setAttribute(
    "aria-label",
    reducedMotion ? "Enable gentle motion" : "Reduce motion",
  );
  $("motion").querySelector("span")!.textContent = reducedMotion
    ? "Still mode"
    : "Motion";
  document.documentElement.classList.toggle("reduced-motion", reducedMotion);
}
syncMotion();
mediaMotion.addEventListener("change", (e) => {
  reducedMotion = e.matches;
  syncMotion();
});
function clearMovement() {
  mouseSteering = false;
  keys.clear();
  touchMovement.forward = touchMovement.right = 0;
  navigation.vx = navigation.vz = 0;
  dragging = null;
}
function syncSound() {
  $("sound").setAttribute("aria-pressed", String(soundEnabled));
  $("sound").setAttribute(
    "aria-label",
    soundEnabled ? "Disable ambient sound" : "Enable ambient sound",
  );
  $("sound").querySelector("span")!.textContent = soundEnabled
    ? "Sound on"
    : "Sound off";
}
$("sound").addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  syncSound();
  void ambience.setEnabled(soundEnabled).catch(() => {
    soundEnabled = false;
    syncSound();
    inform(
      "Sound is unavailable in this browser. The pond is still yours to enjoy.",
    );
  });
});
$("motion").addEventListener("click", () => {
  reducedMotion = !reducedMotion;
  syncMotion();
});
$("reset").addEventListener("click", () => {
  Object.assign(navigation, initialNavigation());
  clearMovement();
  pointer.set(-10, -10);
  tappedId = null;
  inform("Back where you began.");
});
function showGuide() {
  clearMovement();
  guide.showModal();
}
$("help").addEventListener("click", showGuide);
$("close-guide").addEventListener("click", () => guide.close());
$("continue").addEventListener("click", () => guide.close());
function syncTouch() {
  $("touch-controls").hidden = !entered || !mediaTouch.matches;
  $("hint").textContent = mediaTouch.matches
    ? "Drag to look · arrows to glide · tap to discover"
    : "Mouse to steer · centre to rest · hover to discover";
}
mediaTouch.addEventListener("change", syncTouch);
enter.addEventListener("click", () => {
  entered = true;
  $("welcome").hidden = true;
  $("after-entry").hidden = false;
  syncTouch();
  container.querySelector("canvas")?.focus();
});
const movementKeys = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
];
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (
    !entered ||
    guide.open ||
    (e.target instanceof HTMLElement &&
      e.target.closest("button,a,input,select,textarea"))
  )
    return;
  if (movementKeys.includes(key)) {
    e.preventDefault();
    keys.add(key);
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", clearMovement);
document.addEventListener("visibilitychange", () => {
  active = !document.hidden && !graphicsLost;
  clearMovement();
  if (!active) {
    soundEnabled = false;
    syncSound();
    void ambience.setEnabled(false).catch(() => {});
  }
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "#touch-controls button",
)) {
  const set = (value: number) => {
    if (button.dataset.forward)
      touchMovement.forward = Number(button.dataset.forward) * value;
    else touchMovement.right = Number(button.dataset.right) * value;
  };
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    button.setPointerCapture(e.pointerId);
    set(1);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    button.addEventListener(type, () => set(0));
}

async function initialize() {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    enter.hidden = true;
    $("welcome").querySelector("p")!.textContent =
      "This quiet world needs a browser with 3D graphics enabled. Try a current browser with hardware acceleration switched on.";
    $("experience").dataset.ready = "unsupported";
    return;
  }
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, mediaTouch.matches ? 1.35 : 1.75),
  );
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Explore the pond: mouse direction to steer, centre to rest; WASD or arrow keys to glide, drag to look.",
  );
  container.appendChild(canvas);
  const world = createWorld(renderer, mediaTouch.matches ? "low" : "high");
  const { scene, camera, interactive } = world;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  camera.rotation.order = "YXZ";
  function updatePointer(e: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - box.left) / box.width) * 2 - 1,
      (-(e.clientY - box.top) / box.height) * 2 + 1,
    );
  }
  function hoveredEntity() {
    if (!entered || guide.open) return undefined;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster
      .intersectObjects(
        interactive.map((e) => e.object),
        true,
      )
      .find((hit) => !(hit.object instanceof THREE.Sprite));
    if (!hit) return undefined;
    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const entity = interactive.find((e) => e.object === object);
      if (entity) return entity;
      object = object.parent;
    }
    return undefined;
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!entered || guide.open || e.button !== 0) return;
    canvas.focus();
    mouseSteering = false;
    updatePointer(e);
    dragged = false;
    dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    updatePointer(e);
    mouseSteering =
      e.pointerType === "mouse" && e.buttons === 0 && entered && !guide.open;
    if (!dragging || dragging.id !== e.pointerId) return;
    const dx = e.clientX - dragging.x,
      dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
    navigation.yaw -= dx * 0.003;
    navigation.pitch = THREE.MathUtils.clamp(
      navigation.pitch - dy * 0.0025,
      -0.65,
      0.5,
    );
    dragging.x = e.clientX;
    dragging.y = e.clientY;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!dragging || dragging.id !== e.pointerId) return;
    if (!dragged) {
      updatePointer(e);
      tappedId = hoveredEntity()?.id ?? null;
      tapRemaining = 3.5;
    }
    if (e.pointerType === "touch") pointer.set(-10, -10);
    dragging = null;
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = null;
  });
  canvas.addEventListener("lostpointercapture", () => {
    dragging = null;
  });
  canvas.addEventListener("pointerleave", () => {
    if (mouseSteering && keys.size === 0) navigation.vx = navigation.vz = 0;
    mouseSteering = false;
    if (!dragging) pointer.set(-10, -10);
  });
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    graphicsLost = true;
    active = false;
    clearMovement();
    soundEnabled = false;
    syncSound();
    void ambience.setEnabled(false).catch(() => {});
    clearTimeout(noticeTimer);
    $("notice").textContent = "";
    const recovery = document.createElement("section");
    recovery.className = "recovery";
    recovery.setAttribute("role", "alert");
    const message = document.createElement("p");
    message.textContent = "The graphics connection paused.";
    const reload = document.createElement("button");
    reload.className = "enter";
    reload.textContent = "Reload the pond";
    reload.addEventListener("click", () => location.reload());
    recovery.append(message, reload);
    $("experience").appendChild(recovery);
    reload.focus();
  });
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  const pondPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const waterPoint = new THREE.Vector3();
  const waterPointer = new THREE.Vector2();
  let last = performance.now();
  function frame(now: number) {
    if (disposed) return;
    animationId = requestAnimationFrame(frame);
    const interactionDt = Math.min((now - last) / 1000, 0.25);
    const dt = Math.min(interactionDt, 0.05);
    last = now;
    if (!active) return;
    if (!reducedMotion) elapsed += dt;
    const forward =
      Number(keys.has("w") || keys.has("arrowup")) -
      Number(keys.has("s") || keys.has("arrowdown")) +
      touchMovement.forward;
    const right =
      Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft")) +
      touchMovement.right;
    if (entered && !guide.open) {
      const canSteer = mouseSteering && !dragging && keys.size === 0;
      const underMouse = canSteer ? hoveredEntity() : undefined;
      const inspecting =
        underMouse &&
        interactionTarget(
          underMouse.kind,
          Math.hypot(
            underMouse.position.x - navigation.x,
            underMouse.position.z - navigation.z,
          ),
          true,
        ) > 0;
      // Pause over nearby objects so steering cannot pull them away mid-hover.
      if (inspecting) navigation.vx = navigation.vz = 0;
      const steering =
        canSteer && !inspecting
          ? pointerNavigation(pointer.x, pointer.y)
          : { forward: 0, turn: 0 };
      navigation.yaw -= steering.turn * 0.65 * interactionDt;
      advanceNavigation(
        navigation,
        { forward: forward + steering.forward, right },
        interactionDt,
      );
    }
    camera.position.set(navigation.x, navigation.y, navigation.z);
    camera.rotation.set(navigation.pitch, navigation.yaw, 0);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    const hover = dragging ? undefined : hoveredEntity();
    if (tapRemaining <= 0) tappedId = null;
    let overWater = false;
    if (
      entered &&
      !guide.open &&
      !dragging &&
      Math.abs(pointer.x) <= 1 &&
      Math.abs(pointer.y) <= 1
    ) {
      raycaster.setFromCamera(pointer, camera);
      overWater =
        raycaster.ray.direction.y < -0.02 &&
        raycaster.ray.intersectPlane(pondPlane, waterPoint) !== null &&
        waterPoint.distanceTo(camera.position) < 65;
    }
    world.setWaterPointer(
      overWater ? waterPointer.set(waterPoint.x, waterPoint.z) : null,
    );
    for (const entity of interactive) {
      const distance = Math.hypot(
        entity.position.x - navigation.x,
        entity.position.z - navigation.z,
      );
      entity.hovered = hover?.id === entity.id || tappedId === entity.id;
      entity.response = interactionTarget(
        entity.kind,
        distance,
        entity.hovered,
      );
    }
    const responsiveHover = hover && hover.response > 0.5;
    canvas.style.cursor = dragging
      ? "grabbing"
      : responsiveHover
        ? "pointer"
        : mediaTouch.matches
          ? "grab"
          : "default";
    $("hover-label").textContent = responsiveHover
      ? hover.kind === "lotus"
        ? "A little closer, a little more open."
        : "A warm light, blushing red."
      : "";
    world.update(elapsed, interactionDt, reducedMotion);
    // Count rendered interaction time, so a stalled frame cannot discard a new tap.
    tapRemaining = Math.max(0, tapRemaining - interactionDt);
    renderer.render(scene, camera);
  }
  frame(performance.now());
  $("experience").dataset.ready = "true";
  enter.disabled = false;
  enter.textContent = "Enter the pond";
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("test")) {
    Object.assign(window, {
      __stillwater: {
        snapshot: () => ({
          camera: {
            x: navigation.x,
            y: navigation.y,
            z: navigation.z,
            yaw: navigation.yaw,
            pitch: navigation.pitch,
            aspect: camera.aspect,
          },
          navigationSpeed: Math.hypot(navigation.vx, navigation.vz),
          reducedMotion,
          elapsed,
          entered,
          soundEnabled,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          stars: (
            scene.getObjectByName("quiet stars") as THREE.Points
          ).geometry.getAttribute("position").count,
          water: (() => {
            const surface = scene.getObjectByName(
              "rippled reflective water",
            ) as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
            return {
              reflective: "isReflector" in surface,
              flow: surface.material.uniforms.uFlow.value.toArray(),
              strength: surface.material.uniforms.uPointerStrength.value,
              ripples: (
                surface.material.uniforms.uRipples.value as THREE.Vector4[]
              ).map((wave) => wave.toArray()),
            };
          })(),
          entities: interactive.map((e) => {
            const target =
              e.object.children.find((child) =>
                e.kind === "lotus"
                  ? child.name === "lotus bloom"
                  : child instanceof THREE.Mesh &&
                    child.geometry instanceof THREE.SphereGeometry,
              ) ?? e.object;
            const projected = target
              .getWorldPosition(new THREE.Vector3())
              .project(camera);
            return {
              id: e.id,
              kind: e.kind,
              response: e.response,
              hovered: e.hovered ?? false,
              bloomScale: e.object.children.find(
                (c) => c.name === "lotus bloom",
              )?.scale.x,
              lampColor: (() => {
                const shell = e.object.children.find(
                  (c) =>
                    c instanceof THREE.Mesh &&
                    c.geometry instanceof THREE.SphereGeometry,
                ) as
                  | THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
                  | undefined;
                return e.kind === "lantern"
                  ? shell?.material.color.toArray()
                  : undefined;
              })(),
              x: ((projected.x + 1) * innerWidth) / 2,
              y: ((1 - projected.y) * innerHeight) / 2,
              visible:
                projected.z > -1 &&
                projected.z < 1 &&
                Math.abs(projected.x) < 1 &&
                Math.abs(projected.y) < 1,
              position: e.object.position.toArray(),
              petalAngles: e.object.children.map((c) => c.rotation.x),
            };
          }),
        }),
      },
    });
  }
  window.addEventListener("pagehide", (e) => {
    if (e.persisted) return;
    disposed = true;
    cancelAnimationFrame(animationId);
    clearTimeout(noticeTimer);
    world.dispose();
    renderer.dispose();
    void ambience.dispose();
  });
}
void initialize().catch(() => {
  enter.hidden = true;
  $("welcome").querySelector("p")!.textContent =
    "The pond could not load. Please refresh to try again.";
  $("experience").dataset.ready = "error";
});
