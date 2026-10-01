// How far ahead of the car the map centre sits, as a share of the map's extent.
export const AHEAD_FRACTION = 0.3

export interface PixelOffset {
  x: number
  y: number
}

// Screen offset from the car to the map centre for a compass heading, so what
// lies ahead fills the screen instead of the road already driven. Screen y
// grows downwards, hence north is negative.
export function aheadOffset(
  headingDeg: number,
  size: PixelOffset,
  fraction = AHEAD_FRACTION,
): PixelOffset {
  const rad = (headingDeg * Math.PI) / 180
  return {
    x: Math.sin(rad) * size.x * fraction,
    y: -Math.cos(rad) * size.y * fraction,
  }
}
