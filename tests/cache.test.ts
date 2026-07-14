import { peekProvince, putProvince, isFresh, TTL_MS, type Kv, type CacheEntry } from '../src/adapters/cache'

const memKv = (): Kv => {
  const m = new Map<string, CacheEntry>()
  return { get: async id => m.get(id), put: async e => { m.set(e.id, e) } }
}
const res = { fecha: '14/07/2026', stations: [] }

describe('cache', () => {
  it('peekProvince returns a stored entry', async () => {
    const kv = memKv()
    await putProvince('28', res, 1000, kv)
    expect((await peekProvince('28', kv))?.id).toBe('28')
  })
  it('peekProvince returns a stale entry regardless of age; isFresh reflects the TTL boundary', async () => {
    const kv = memKv()
    await putProvince('28', res, 1000, kv)
    const e = await peekProvince('28', kv)
    expect(e?.id).toBe('28')                        // present even though stale
    expect(isFresh(e!, 1000 + TTL_MS - 1)).toBe(true)
    expect(isFresh(e!, 1000 + TTL_MS + 1)).toBe(false)
  })
})
