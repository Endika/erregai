import { Store } from '../src/app/store'
import { fetchProvince } from '../src/adapters/api'
import type { Kv, CacheEntry } from '../src/adapters/cache'
import type { Station } from '../src/core/station'

const memKv = (): Kv => {
  const m = new Map<string, CacheEntry>()
  return {
    get: async (id) => m.get(id),
    put: async (e) => {
      m.set(e.id, e)
    },
  }
}
const brokenKv = (): Kv => ({
  get: async () => {
    throw new Error('idb read failed')
  },
  put: async () => {
    throw new Error('idb write failed')
  },
})
const stn = (id: string): Station => ({
  id,
  brand: 'X',
  name: 'X',
  pos: { lat: 40.4, lon: -3.7 },
  address: '',
  town: '',
  schedule: '',
  prices: { gasoleoA: 1.5 },
})

describe('store.loadFor', () => {
  it('fetches on cache miss then serves from cache on second call', async () => {
    let calls = 0
    const fake = async () => {
      calls++
      return { fecha: 'x', stations: [stn('1')] }
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 }) // Madrid
    expect(store.state.stations.length).toBe(1)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(calls).toBe(1) // second call served from cache
  })
  it('sets error and does not throw on network failure', async () => {
    const fake = async () => {
      throw new Error('boom')
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(store.state.error).toBeTruthy()
    expect(store.state.loading).toBe(false)
  })
  it('ensureAround merges current + adjacent provinces, deduped by id', async () => {
    const calls: string[] = []
    // fetch echoes the province id into the returned station id so we can assert the union
    const fake = async (id: string) => {
      calls.push(id)
      return { fecha: 'x', stations: [stn(`p${id}`), stn('shared')] }
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.ensureAround({ lat: 40.4168, lon: -3.7038 }, 2) // Madrid + 2 neighbours = 3 provinces
    expect(calls.length).toBe(3)
    const ids = store.state.stations.map((s) => s.id)
    expect(ids.filter((x) => x === 'shared').length).toBe(1) // deduped across provinces
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('serves fresh cache without refetch, and refresh() forces a refetch', async () => {
    let calls = 0
    const fake = async () => {
      calls++
      return { fecha: `f${calls}`, stations: [stn('1')] }
    }
    const kv = memKv()
    let clock = 1000
    const store = new Store({ fetchProvince: fake, kv, now: () => clock })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 }) // miss -> fetch (calls=1)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 }) // fresh cache -> no fetch
    expect(calls).toBe(1)
    await store.refresh() // forced -> refetch
    expect(calls).toBe(2)
    expect(store.state.dataDate).toBe('f2')
  })
  it('ensureAround: a province failing with no cache keeps state.error set even when a later sibling province succeeds', async () => {
    const callOrder: string[] = []
    const fake = async (id: string) => {
      callOrder.push(id)
      if (callOrder.length === 2) throw new Error('offline')
      return { fecha: 'x', stations: [stn(`p${id}`), stn('shared')] }
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.ensureAround({ lat: 40.4168, lon: -3.7038 }, 2) // Madrid + 2 neighbours = 3 provinces
    expect(callOrder.length).toBe(3)
    expect(store.state.error).toBeTruthy() // one province failed with no cache -> batch error surfaced
    const failedId = callOrder[1]
    const ids = store.state.stations.map((s) => s.id)
    expect(ids).not.toContain(`p${failedId}`) // failed province contributed no stations
    expect(ids.filter((x) => x === 'shared').length).toBe(1) // dedupe across the 2 successful provinces still holds
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('keeps stale cached data visible when a background refetch fails', async () => {
    let calls = 0
    const fake = async () => {
      calls++
      if (calls > 1) throw new Error('offline')
      return { fecha: 'f1', stations: [stn('1')] }
    }
    const kv = memKv()
    let clock = 1000
    const store = new Store({ fetchProvince: fake, kv, now: () => clock })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 }) // fetch ok, cached at t=1000
    clock = 1000 + 7 * 60 * 60 * 1000 // now stale (past 6h TTL)
    await store.loadFor({ lat: 40.4168, lon: -3.7038 }) // shows stale, revalidate fails
    expect(store.state.stations.length).toBe(1) // stale data still visible
    expect(store.state.error).toBeUndefined() // failure with cache present is not the no-data error
    expect(store.state.refreshError).toBe('offline') // but it is still reported
    expect(store.state.dataStoredAt).toBe(1000) // so the UI can say how old the prices are
  })
  it('refresh() after a first load that failed with no cache retries that province', async () => {
    let online = false
    const fake = async () => {
      if (!online) throw new Error('offline')
      return { fecha: 'f1', stations: [stn('1')] }
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(store.state.error).toBe('offline')
    online = true
    await store.refresh()
    expect(store.state.error).toBeUndefined()
    expect(store.state.stations.length).toBe(1)
  })
  it('a failed refresh() over cached data reports refreshError, and the next good refresh clears it', async () => {
    let online = true
    const fake = async () => {
      if (!online) throw new Error('offline')
      return { fecha: 'f1', stations: [stn('1')] }
    }
    const store = new Store({ fetchProvince: fake, kv: memKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    online = false
    await store.refresh()
    expect(store.state.stations.map((s) => s.id)).toEqual(['1'])
    expect(store.state.dataDate).toBe('f1')
    expect(store.state.error).toBeUndefined()
    expect(store.state.refreshError).toBe('offline')
    online = true
    await store.refresh()
    expect(store.state.refreshError).toBeUndefined()
  })
  it('a malformed ministry response keeps the good cache and, with nothing cached, sets error', async () => {
    let body: unknown = {
      Fecha: '14/09/2026',
      ListaEESSPrecio: [{ IDEESS: '1', Latitud: '40,4', 'Longitud (WGS84)': '-3,7' }],
    }
    const fetchFn = (async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })) as unknown as typeof fetch
    const kv = memKv()
    let clock = 1000
    const store = new Store({
      fetchProvince: (id) => fetchProvince(id, fetchFn),
      kv,
      now: () => clock,
    })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    body = { Fecha: '15/09/2026', ListaPreciosEESS: [] }
    clock = 1000 + 7 * 60 * 60 * 1000
    await store.refresh()
    expect(store.state.stations.map((s) => s.id)).toEqual(['1'])
    expect(store.state.dataDate).toBe('14/09/2026')
    expect(store.state.refreshError).toBe('unexpected response for province 28')
    const reopened = new Store({
      fetchProvince: (id) => fetchProvince(id, fetchFn),
      kv: memKv(),
      now: () => clock,
    })
    await reopened.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(reopened.state.stations).toEqual([])
    expect(reopened.state.error).toBe('unexpected response for province 28')
  })
  it('a broken IndexedDB still loads from the network and reports storageFailed, not a location or network error', async () => {
    const fake = async () => ({ fecha: 'f1', stations: [stn('1')] })
    const store = new Store({ fetchProvince: fake, kv: brokenKv(), now: () => 1000 })
    await store.loadFor({ lat: 40.4168, lon: -3.7038 })
    expect(store.state.stations.map((s) => s.id)).toEqual(['1'])
    expect(store.state.dataDate).toBe('f1')
    expect(store.state.error).toBeUndefined()
    expect(store.state.storageFailed).toBe(true)
  })
  it('a cache write failure keeps the fetched data and reports storageFailed', async () => {
    const m = new Map<string, CacheEntry>()
    const readOnlyKv: Kv = {
      get: async (id) => m.get(id),
      put: async () => {
        throw new Error('quota exceeded')
      },
    }
    const fake = async () => ({ fecha: 'f1', stations: [stn('1')] })
    const store = new Store({ fetchProvince: fake, kv: readOnlyKv, now: () => 1000 })
    await store.ensureAround({ lat: 40.4168, lon: -3.7038 }, 0)
    expect(store.state.stations.map((s) => s.id)).toEqual(['1'])
    expect(store.state.error).toBeUndefined()
    expect(store.state.storageFailed).toBe(true)
  })
})
