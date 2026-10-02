import type { Navigation } from "./navigation";

export type WorldId = "pond" | "forest";
export const passageAnchor = (world: WorldId) => ({
  x: 0,
  z: world === "pond" ? -25 : 18,
});
const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function createPassage(world: WorldId = "pond") {
  return {
    world,
    phase: "idle" as "idle" | "travel",
    opening: 0,
    opacity: 0,
    progress: 0,
    switched: false,
    origin: { x: 0, z: 0, yaw: 0, pitch: 0 },
    reduced: false,
  };
}
export type Passage = ReturnType<typeof createPassage>;
export function cancelPassage(state: Passage) {
  state.phase = "idle";
  state.opening = state.opacity = state.progress = 0;
}
export function beginPassage(
  state: Passage,
  nav: Navigation,
  reducedMotion: boolean,
) {
  if (state.phase === "travel") return;
  state.phase = "travel";
  state.progress = 0;
  state.switched = false;
  state.reduced = reducedMotion;
  state.origin = { x: nav.x, z: nav.z, yaw: nav.yaw, pitch: nav.pitch };
  nav.vx = nav.vz = 0;
}
export function advancePassage(
  state: Passage,
  nav: Navigation,
  forward: number,
  dt: number,
  reducedMotion: boolean,
): { opacity: number; switchTo?: WorldId } {
  const delta = Math.min(0.25, Math.max(0, dt));
  if (state.phase === "idle") {
    const anchor = passageAnchor(state.world);
    const distance = Math.hypot(nav.x - anchor.x, nav.z - anchor.z);
    const near =
      Math.abs(nav.x) < 9 ? Math.max(0, Math.min(1, (16 - distance) / 12)) : 0;
    state.opening = reducedMotion
      ? near
      : lerp(state.opening, near, 1 - Math.exp(-delta * 2.5));
    const direction = state.world === "pond" ? 1 : -1;
    const facing = Math.cos(nav.yaw) * direction > 0.7;
    if (
      distance < 3.2 &&
      forward > 0.1 &&
      facing &&
      (state.opening > 0.75 || reducedMotion)
    ) {
      beginPassage(state, nav, reducedMotion);
    }
    return { opacity: state.opacity };
  }
  // A motion preference change mid-flight stops the flight and finishes as a fade.
  state.reduced ||= reducedMotion;
  state.progress = Math.min(
    1,
    state.progress + delta / (state.reduced ? 0.6 : 5),
  );
  const p = state.progress;
  let switchTo: WorldId | undefined;
  state.opening = 1;
  state.opacity = ease(
    Math.min(1, Math.max(0, p < 0.5 ? (p - 0.28) / 0.17 : (0.85 - p) / 0.3)),
  );
  if (p >= 0.5 && !state.switched) {
    state.switched = true;
    state.world = state.world === "pond" ? "forest" : "pond";
    switchTo = state.world;
    state.opacity = 1;
    Object.assign(nav, {
      x: 0,
      y: 2.2,
      z: state.world === "forest" ? 12 : -23,
      yaw: state.world === "forest" ? 0 : Math.PI,
      pitch: -0.09,
      vx: 0,
      vz: 0,
    });
  }
  if (!state.reduced) {
    if (!state.switched) {
      const t = ease(Math.min(1, p * 2));
      const targetYaw = state.world === "pond" ? 0 : Math.PI;
      const shortestYaw = Math.atan2(
        Math.sin(targetYaw - state.origin.yaw),
        Math.cos(targetYaw - state.origin.yaw),
      );
      nav.x = lerp(state.origin.x, 0, t);
      nav.z = lerp(state.origin.z, state.world === "pond" ? -82 : 28, t);
      nav.yaw = state.origin.yaw + shortestYaw * t;
      nav.pitch = lerp(state.origin.pitch, -0.035, t);
    } else {
      const t = ease(Math.max(0, (p - 0.5) * 2));
      nav.z = state.world === "forest" ? lerp(12, 9.5, t) : lerp(-23, -20, t);
    }
  }
  nav.vx = nav.vz = 0;
  if (p >= 1) cancelPassage(state);
  return { opacity: state.opacity, switchTo };
}
