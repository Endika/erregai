export interface ConnectivityOptions {
  // Coverage that comes back often drops again within a second or two.
  delayMs: number
  onChange: () => void
  shouldRefresh: () => boolean
  refresh: () => Promise<void>
}

// Redraws on every change, so the copy follows the connection, and refreshes
// at most once per reconnect: never on a timer, never over a running refresh.
export function watchConnectivity(
  target: EventTarget,
  { delayMs, onChange, shouldRefresh, refresh }: ConnectivityOptions,
): () => void {
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined
  let running = false

  const cancel = (): void => {
    globalThis.clearTimeout(timer)
    timer = undefined
  }
  const onOffline = (): void => {
    cancel()
    onChange()
  }
  const onOnline = (): void => {
    cancel()
    onChange()
    timer = globalThis.setTimeout(() => {
      timer = undefined
      if (running || !shouldRefresh()) return
      running = true
      void refresh().finally(() => {
        running = false
      })
    }, delayMs)
  }

  target.addEventListener('offline', onOffline)
  target.addEventListener('online', onOnline)
  return () => {
    cancel()
    target.removeEventListener('offline', onOffline)
    target.removeEventListener('online', onOnline)
  }
}
