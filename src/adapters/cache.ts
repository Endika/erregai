import type { ProvinceResult } from './api'
import type { Station } from '../core/station'

export interface CacheEntry { id: string; fecha: string; stations: Station[]; storedAt: number }
export interface Kv { get(id: string): Promise<CacheEntry | undefined>; put(e: CacheEntry): Promise<void> }
export const TTL_MS = 6 * 60 * 60 * 1000

export function isFresh(e: CacheEntry, now: number): boolean {
  return now - e.storedAt < TTL_MS
}

export function peekProvince(id: string, kv: Kv): Promise<CacheEntry | undefined> {
  return kv.get(id)
}

export async function putProvince(id: string, res: ProvinceResult, now: number, kv: Kv): Promise<CacheEntry> {
  const e: CacheEntry = { id, fecha: res.fecha, stations: res.stations, storedAt: now }
  await kv.put(e)
  return e
}

export function openIdbKv(): Kv {
  const dbp = new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('erregai', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('provinces', { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await dbp
    return new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction('provinces', mode).objectStore('provinces'))
      req.onsuccess = () => resolve(req.result as T); req.onerror = () => reject(req.error)
    })
  }
  return {
    get: id => tx<CacheEntry | undefined>('readonly', s => s.get(id)),
    put: async e => { await tx('readwrite', s => s.put(e)) },
  }
}
