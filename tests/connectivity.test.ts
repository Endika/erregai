import { vi } from 'vitest'
import { watchConnectivity } from '../src/app/connectivity'

const DELAY = 2000

function setup(shouldRefresh = true) {
  const target = new EventTarget()
  const onChange = vi.fn()
  let settle: () => void = () => {}
  const refresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        settle = resolve
      }),
  )
  const stop = watchConnectivity(target, {
    delayMs: DELAY,
    onChange,
    shouldRefresh: () => shouldRefresh,
    refresh,
  })
  const fire = (type: 'online' | 'offline') => target.dispatchEvent(new Event(type))
  return { onChange, refresh, fire, stop, settle: () => settle() }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('watchConnectivity', () => {
  it('redraws as soon as the connection drops, without fetching anything', () => {
    const { onChange, refresh, fire } = setup()
    fire('offline')
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(DELAY * 2)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('redraws on reconnect and refreshes once the connection has settled', () => {
    const { onChange, refresh, fire } = setup()
    fire('online')
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(DELAY - 1)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('folds a flapping connection into a single refresh', () => {
    const { refresh, fire } = setup()
    fire('online')
    vi.advanceTimersByTime(DELAY / 2)
    fire('offline')
    fire('online')
    vi.advanceTimersByTime(DELAY / 2)
    fire('online')
    vi.advanceTimersByTime(DELAY)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('drops the pending refresh when the connection goes again before it fires', () => {
    const { refresh, fire } = setup()
    fire('online')
    fire('offline')
    vi.advanceTimersByTime(DELAY * 2)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('never stacks a second refresh on one still running', async () => {
    const { refresh, fire, settle } = setup()
    fire('online')
    vi.advanceTimersByTime(DELAY)
    fire('online')
    vi.advanceTimersByTime(DELAY)
    expect(refresh).toHaveBeenCalledTimes(1)
    settle()
    await vi.runAllTimersAsync()
    fire('online')
    vi.advanceTimersByTime(DELAY)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('leaves fresh, working data alone on reconnect', () => {
    const { onChange, refresh, fire } = setup(false)
    fire('online')
    vi.advanceTimersByTime(DELAY)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('stops listening and cancels a pending refresh when stopped', () => {
    const { onChange, refresh, fire, stop } = setup()
    fire('online')
    stop()
    fire('offline')
    vi.advanceTimersByTime(DELAY)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })
})
