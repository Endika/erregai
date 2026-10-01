import type { LatLon } from '../core/geo'
import type { Station } from '../core/station'
import type { ProvinceResult } from '../adapters/api'
import { fetchProvince } from '../adapters/api'
import { peekProvince, putProvince, isFresh, type Kv, type CacheEntry } from '../adapters/cache'
import { provinceFor, adjacentProvinces } from '../core/provinces'
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from './settings'

export interface AppState {
  pos?: LatLon
  stations: Station[]
  dataDate?: string
  dataStoredAt?: number
  loading: boolean
  error?: string
  refreshError?: string
  storageFailed?: boolean
  settings: Settings
}

interface ProvinceOutcome {
  fetchError?: string
  storageFailed: boolean
}

export interface Deps {
  fetchProvince: typeof fetchProvince
  kv: Kv
  now: () => number
}

export class Store {
  private deps: Deps
  private provinces = new Map<string, CacheEntry>()
  private subscribers = new Set<() => void>()
  private current: AppState
  private currentProvinceId?: string

  constructor(deps: Deps) {
    this.deps = deps
    const settings = typeof localStorage !== 'undefined' ? loadSettings() : { ...DEFAULT_SETTINGS }
    this.current = { stations: [], loading: false, settings }
  }

  get state(): AppState {
    return this.current
  }

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn)
    return () => {
      this.subscribers.delete(fn)
    }
  }

  setSettings(partial: Partial<Settings>): void {
    const settings = { ...this.current.settings, ...partial }
    this.current = { ...this.current, settings }
    saveSettings(settings)
    this.notify()
  }

  async loadFor(pos: LatLon): Promise<void> {
    const box = provinceFor(pos)
    this.current = { ...this.current, pos }
    this.currentProvinceId = box.id
    await this.runBatch([box.id])
    this.updateDataDate()
    this.notify()
  }

  async ensureAround(pos: LatLon, adjacent: number): Promise<void> {
    const box = provinceFor(pos)
    this.current = { ...this.current, pos }
    this.currentProvinceId = box.id
    const ids = [box.id, ...adjacentProvinces(box.id, adjacent).map((b) => b.id)]
    await this.runBatch(ids)
    this.updateDataDate()
    this.notify()
  }

  // Includes the current province even when its first load failed with
  // nothing cached, so Retry/Refresh recovers instead of doing nothing.
  async refresh(): Promise<void> {
    const ids = new Set(this.provinces.keys())
    if (this.currentProvinceId) ids.add(this.currentProvinceId)
    await this.runBatch([...ids], true)
    this.updateDataDate()
    this.notify()
  }

  // Runs ensureProvince for each id and derives batch-level feedback. A failed
  // fetch is an error only when it left that province with no data (a sibling
  // province's success must not mask that); over cached data it is a
  // refreshError, so the stations stay visible and the user still hears of it.
  private async runBatch(ids: string[], force = false): Promise<void> {
    let error: string | undefined
    let refreshError: string | undefined
    let storageFailed = false
    for (const id of ids) {
      const outcome = await this.ensureProvince(id, force)
      if (outcome.fetchError) {
        if (this.provinces.has(id)) refreshError = outcome.fetchError
        else error = outcome.fetchError
      }
      if (outcome.storageFailed) storageFailed = true
    }
    this.current = { ...this.current, error, refreshError, storageFailed }
  }

  private updateDataDate(): void {
    if (!this.currentProvinceId) return
    const entry = this.provinces.get(this.currentProvinceId)
    this.current = { ...this.current, dataDate: entry?.fecha, dataStoredAt: entry?.storedAt }
  }

  // Loads a single province (cache-then-network). Does NOT touch state itself:
  // runBatch decides, at the end of the whole batch, what the outcome means.
  // A broken IndexedDB degrades to network-only instead of failing the load.
  private async ensureProvince(id: string, force = false): Promise<ProvinceOutcome> {
    this.current = { ...this.current, loading: true }
    this.notify()
    let storageFailed = false
    try {
      let cached: CacheEntry | undefined
      try {
        cached = await peekProvince(id, this.deps.kv)
      } catch {
        storageFailed = true
        cached = this.provinces.get(id)
      }
      if (cached) {
        this.provinces.set(id, cached)
        this.rebuildStations()
        this.notify()
      }
      if (!cached || !isFresh(cached, this.deps.now()) || force) {
        let result: ProvinceResult
        try {
          result = await this.deps.fetchProvince(id)
        } catch (err) {
          return { fetchError: err instanceof Error ? err.message : String(err), storageFailed }
        }
        const now = this.deps.now()
        let entry: CacheEntry
        try {
          entry = await putProvince(id, result, now, this.deps.kv)
        } catch {
          storageFailed = true
          entry = { id, fecha: result.fecha, stations: result.stations, storedAt: now }
        }
        this.provinces.set(id, entry)
        this.rebuildStations()
      }
      return { storageFailed }
    } finally {
      this.current = { ...this.current, loading: false }
      this.notify()
    }
  }

  private rebuildStations(): void {
    const seen = new Set<string>()
    const stations: Station[] = []
    for (const entry of this.provinces.values()) {
      for (const s of entry.stations) {
        if (!seen.has(s.id)) {
          seen.add(s.id)
          stations.push(s)
        }
      }
    }
    this.current = { ...this.current, stations }
  }

  private notify(): void {
    for (const fn of this.subscribers) fn()
  }
}
