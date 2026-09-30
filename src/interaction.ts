export function interactionTarget(
  kind: "lotus" | "lantern",
  distance: number,
  hovered: boolean,
): number {
  const radius = kind === "lotus" ? 5.5 : 8;
  if (distance >= radius) return 0;
  if (hovered) return 1;
  const proximity = Math.max(0, 1 - distance / radius);
  return proximity * proximity * (kind === "lotus" ? 0.45 : 1);
}
