type WakeLockSentinelLike = { release(): Promise<void> }
type WakeLockLike = { request(type: 'screen'): Promise<WakeLockSentinelLike> }
type NavigatorLike = { wakeLock?: WakeLockLike }

// Keeps the screen awake while a trip is active. Returns a release function.
// The OS drops the lock whenever the page is hidden, so we re-acquire on
// return to the foreground. Silent no-op when the API is unsupported (e.g.
// older iOS) or the request is denied. `nav` is injectable for testing.
export function keepScreenAwake(nav: NavigatorLike = navigator): () => void {
  const wakeLock = nav.wakeLock
  if (!wakeLock) return () => {}

  let sentinel: WakeLockSentinelLike | null = null
  let stopped = false

  const acquire = async (): Promise<void> => {
    if (stopped) return
    try {
      sentinel = await wakeLock.request('screen')
    } catch {
      /* denied or unavailable — leave the screen to its default timeout */
    }
  }

  const onVisibility = (): void => {
    if (!stopped && document.visibilityState === 'visible') void acquire()
  }
  document.addEventListener('visibilitychange', onVisibility)
  void acquire()

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release().catch(() => {})
    sentinel = null
  }
}
