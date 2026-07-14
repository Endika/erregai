import { Store } from '../src/app/store'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import type { Station } from '../src/core/station'

const memKv = (): Kv => { const m = new Map<string, CacheEntry>(); return { get: async id => m.get(id), put: async e => { m.set(e.id, e) } } }
const stn = (id: string): Station => ({ id, brand: 'X', name: 'X', pos: { lat: 40.4, lon: -3.7 }, address: '', town: '', schedule: '', prices: { gasoleoA: 1.5 } })

describe('store.loadFor', () => {
  it('fetches on cache miss then serves from cache on second call', async () => {
    let calls = 0
    const fake = async () => { calls++; return { fecha: 'x', stations: [stn('1')] } }
    const store = new Store({ fetchProvince: fake as any, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })   // Madrid
    expect(store.state.stations.length).toBe(1)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(calls).toBe(1)                                  // second call served from cache
  })
  it('sets error and does not throw on network failure', async () => {
    const fake = async () => { throw new Error('boom') }
    const store = new Store({ fetchProvince: fake as any, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(store.state.error).toBeTruthy()
    expect(store.state.loading).toBe(false)
  })
  it('ensureAround merges current + adjacent provinces, deduped by id', async () => {
    const calls: string[] = []
    // fetch echoes the province id into the returned station id so we can assert the union
    const fake = (async (id: string) => { calls.push(id); return { fecha: 'x', stations: [stn(`p${id}`), stn('shared')] } })
    const store = new Store({ fetchProvince: fake as any, kv: memKv(), now: () => 1000 })
    await store.ensureAround({ lat: 40.4168, lon: -3.7038 }, 2)  // Madrid + 2 neighbours = 3 provinces
    expect(calls.length).toBe(3)
    const ids = store.state.stations.map(s => s.id)
    expect(ids.filter(x => x === 'shared').length).toBe(1)       // deduped across provinces
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('serves fresh cache without refetch, and refresh() forces a refetch', async () => {
    let calls = 0
    const fake = async () => { calls++; return { fecha: `f${calls}`, stations: [stn('1')] } }
    const kv = memKv()
    let clock = 1000
    const store = new Store({ fetchProvince: fake as any, kv, now: () => clock })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })         // miss -> fetch (calls=1)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })         // fresh cache -> no fetch
    expect(calls).toBe(1)
    await store.refresh()                                        // forced -> refetch
    expect(calls).toBe(2)
    expect(store.state.dataDate).toBe('f2')
  })
  it('ensureAround: a province failing with no cache keeps state.error set even when a later sibling province succeeds', async () => {
    const callOrder: string[] = []
    const fake = (async (id: string) => {
      callOrder.push(id)
      if (callOrder.length === 2) throw new Error('offline')
      return { fecha: 'x', stations: [stn(`p${id}`), stn('shared')] }
    })
    const store = new Store({ fetchProvince: fake as any, kv: memKv(), now: () => 1000 })
    await store.ensureAround({ lat: 40.4168, lon: -3.7038 }, 2)  // Madrid + 2 neighbours = 3 provinces
    expect(callOrder.length).toBe(3)
    expect(store.state.error).toBeTruthy()                        // one province failed with no cache -> batch error surfaced
    const failedId = callOrder[1]
    const ids = store.state.stations.map(s => s.id)
    expect(ids).not.toContain(`p${failedId}`)                     // failed province contributed no stations
    expect(ids.filter(x => x === 'shared').length).toBe(1)        // dedupe across the 2 successful provinces still holds
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('keeps stale cached data visible when a background refetch fails', async () => {
    let calls = 0
    const fake = async () => { calls++; if (calls > 1) throw new Error('offline'); return { fecha: 'f1', stations: [stn('1')] } }
    const kv = memKv()
    let clock = 1000
    const store = new Store({ fetchProvince: fake as any, kv, now: () => clock })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })         // fetch ok, cached at t=1000
    clock = 1000 + 7 * 60 * 60 * 1000                           // now stale (past 6h TTL)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })         // shows stale, revalidate fails
    expect(store.state.stations.length).toBe(1)                 // stale data still visible
    expect(store.state.error).toBeUndefined()                   // failure with cache present is not an error
  })
})
