// Haptic fallback for the alert cues, for when the phone is in a pocket, the
// media volume is down, or the car stereo owns the speaker.
//
// Vibration API support is Android-only in practice: iOS Safari does not
// implement navigator.vibrate at all, so on iPhone this is a silent no-op and
// audio remains the only cue.
export type Vibrator = (pattern: number | readonly number[]) => boolean

// Patterns mirror the audio cues so sound and haptics read as the same alert:
// the radar buzz is a double pulse like its double beep, the fuel one a single
// shorter pulse like its chime.
const RADAR_PATTERN: readonly number[] = [200, 100, 200]
const FUEL_PATTERN: readonly number[] = [150]

// lib.dom declares navigator.vibrate unconditionally, but the browsers that
// matter here disagree, so probe it at call time instead of trusting the type.
function defaultVibrator(): Vibrator | undefined {
  const vibrate = (navigator as unknown as { vibrate?: Vibrator }).vibrate
  return typeof vibrate === 'function' ? vibrate.bind(navigator) : undefined
}

// Silent no-op when the API is missing or refuses the request, so callers can
// fire haptics unconditionally. Vibrator is injectable for testing.
function buzz(pattern: readonly number[], vibrator: Vibrator | undefined): void {
  if (!vibrator) return
  try {
    vibrator(pattern)
  } catch {
    /* vibration unavailable or blocked — silent no-op */
  }
}

export function vibrateRadar(vibrator: Vibrator | undefined = defaultVibrator()): void {
  buzz(RADAR_PATTERN, vibrator)
}

export function vibrateFuel(vibrator: Vibrator | undefined = defaultVibrator()): void {
  buzz(FUEL_PATTERN, vibrator)
}
