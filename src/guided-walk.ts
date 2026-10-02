import type { Navigation } from "./navigation";
import { passageAnchor } from "./passage";

export function advanceMountainWalk(nav: Navigation, dt: number): void {
  const delta = Math.min(0.25, Math.max(0, dt));
  const target = passageAnchor("pond");
  const dx = target.x - nav.x;
  const dz = target.z - nav.z;
  const distance = Math.hypot(dx, dz);
  const targetYaw = distance > 0.1 ? Math.atan2(-dx, -dz) : 0;
  const turn = Math.atan2(
    Math.sin(targetYaw - nav.yaw),
    Math.cos(targetYaw - nav.yaw),
  );
  const smoothing = 1 - Math.exp(-delta * 3);
  nav.yaw += turn * smoothing;
  nav.pitch += (-0.035 - nav.pitch) * smoothing;
  const step = Math.min(distance, 2.4 * delta);
  if (distance > 0) {
    nav.x += (dx / distance) * step;
    nav.z += (dz / distance) * step;
  }
  nav.vx = nav.vz = 0;
}
