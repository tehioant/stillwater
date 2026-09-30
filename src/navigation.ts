export interface Navigation {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
}
export interface Movement {
  forward: number;
  right: number;
}
export const initialNavigation = (): Navigation => ({
  x: 0,
  y: 2.2,
  z: 12,
  yaw: 0,
  pitch: -0.09,
  vx: 0,
  vz: 0,
});
export function advanceNavigation(
  state: Navigation,
  input: Movement,
  dt: number,
): void {
  const elapsed = dt > 0.25 ? 0.05 : Math.max(0, dt);
  let remaining = elapsed;
  while (remaining > 1e-8) {
    const step = Math.min(remaining, 0.05);
    advanceStep(state, input, step);
    remaining -= step;
  }
}

function advanceStep(state: Navigation, input: Movement, dt: number): void {
  const norm = Math.max(1, Math.hypot(input.forward, input.right));
  const forward = input.forward / norm;
  const right = input.right / norm;
  const damping = 1 - Math.exp(-4 * dt);
  state.vx +=
    ((Math.cos(state.yaw) * right - Math.sin(state.yaw) * forward) * 2.4 -
      state.vx) *
    damping;
  state.vz +=
    ((-Math.sin(state.yaw) * right - Math.cos(state.yaw) * forward) * 2.4 -
      state.vz) *
    damping;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  const radius = Math.hypot(state.x, state.z);
  if (radius > 27) {
    state.x *= 27 / radius;
    state.z *= 27 / radius;
    const outward = (state.vx * state.x + state.vz * state.z) / 27;
    if (outward > 0) {
      state.vx -= (outward * state.x) / 27;
      state.vz -= (outward * state.z) / 27;
    }
  }
}
