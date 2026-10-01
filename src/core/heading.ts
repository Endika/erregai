import { bearingDeg, haversineKm, type LatLon } from './geo'

// What the browser reports alongside a position; each field may be null or
// missing depending on the device and whether it is moving.
export interface FixInfo {
  heading?: number | null
  speed?: number | null
  accuracy?: number | null
}

export interface HeadingState {
  headingDeg: number | undefined
  anchor: LatLon | undefined
}

// ~7 km/h: below it the GPS course is dominated by noise.
export const GPS_HEADING_MIN_SPEED_MPS = 2
// Larger than the few metres a phone drifts while stopped at a light.
export const HEADING_MIN_MOVE_M = 25

export function newHeadingState(): HeadingState {
  return { headingDeg: undefined, anchor: undefined }
}

export function nextHeading(state: HeadingState, pos: LatLon, fix: FixInfo = {}): HeadingState {
  const { heading, speed, accuracy } = fix
  if (
    typeof heading === 'number' &&
    Number.isFinite(heading) &&
    typeof speed === 'number' &&
    speed > GPS_HEADING_MIN_SPEED_MPS
  ) {
    return { headingDeg: heading, anchor: pos }
  }
  if (!state.anchor) return { headingDeg: state.headingDeg, anchor: pos }
  const minMoveM =
    typeof accuracy === 'number' && Number.isFinite(accuracy)
      ? Math.max(HEADING_MIN_MOVE_M, accuracy)
      : HEADING_MIN_MOVE_M
  if (haversineKm(state.anchor, pos) * 1000 < minMoveM) return state
  return { headingDeg: bearingDeg(state.anchor, pos), anchor: pos }
}
