// @vitest-environment jsdom
import { keepScreenAwake } from '../src/adapters/wakeLock'

const flush = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve() }

it('no-ops safely when the Wake Lock API is unavailable', () => {
  const release = keepScreenAwake({})
  expect(() => release()).not.toThrow()
})

it('requests a screen lock on start and releases it on stop', async () => {
  let requested = 0
  let released = false
  const sentinel = { release: async () => { released = true } }
  const nav = { wakeLock: { request: async (_type: 'screen') => { requested++; return sentinel } } }

  const release = keepScreenAwake(nav)
  await flush()
  expect(requested).toBe(1)

  release()
  await flush()
  expect(released).toBe(true)
})
