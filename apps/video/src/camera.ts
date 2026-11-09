import { Easing } from "remotion";

// The camera looks at (x, y) in scene pixels; zoom 1 shows the whole scene.
export type Shot = { at: number; x: number; y: number; zoom: number };

// Slow on purpose: every move takes this long and eases in and out.
export const TRAVEL = 1.4;
const ease = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// From each shot's `at`, the camera glides to it over TRAVEL seconds and holds.
export function cameraAt(
  shots: Shot[],
  t: number,
  width: number,
  height: number,
) {
  let { x, y, zoom } = shots[0];
  for (const shot of shots.slice(1)) {
    if (t < shot.at) break;
    const k = ease(clamp((t - shot.at) / TRAVEL, 0, 1));
    x += (shot.x - x) * k;
    y += (shot.y - y) * k;
    // Geometric, so zooming in and out feel equally fast.
    zoom *= (shot.zoom / zoom) ** k;
  }
  const halfW = width / (2 * zoom);
  const halfH = height / (2 * zoom);
  return {
    x: clamp(x, halfW, width - halfW),
    y: clamp(y, halfH, height - halfH),
    zoom,
  };
}

export function cameraTransform(
  shots: Shot[],
  t: number,
  width: number,
  height: number,
) {
  const { x, y, zoom } = cameraAt(shots, t, width, height);
  return `translate(${width / 2 - x * zoom}px, ${height / 2 - y * zoom}px) scale(${zoom})`;
}
