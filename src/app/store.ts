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
  loading: boolean
  error?: string
  settings: Settings
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
    return () => { this.subscribers.delete(fn) }
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
    await this.ensureProvince(box.id)
    this.updateDataDate()
    this.notify()
  }

  async ensureAround(pos: LatLon, adjacent: number): Promise<void> {
    const box = provinceFor(pos)
    this.current = { ...this.current, pos }
    this.currentProvinceId = box.id
    const ids = [box.id, ...adjacentProvinces(box.id, adjacent).map(b => b.id)]
    for (const id of ids) {
      await this.ensureProvince(id)
    }
    this.updateDataDate()
    this.notify()
  }

  async refresh(): Promise<void> {
    for (const id of [...this.provinces.keys()]) {
      await this.ensureProvince(id, true)
    }
    this.updateDataDate()
    this.notify()
  }

  private updateDataDate(): void {
    if (!this.currentProvinceId) return
    const entry = this.provinces.get(this.currentProvinceId)
    this.current = { ...this.current, dataDate: entry?.fecha }
  }

  private async ensureProvince(id: string, force = false): Promise<void> {
    this.current = { ...this.current, loading: true }
    this.notify()
    try {
      const cached = await peekProvince(id, this.deps.kv)
      if (cached) {
        this.provinces.set(id, cached)
        this.rebuildStations()
        this.notify()
      }
      if (!cached || !isFresh(cached, this.deps.now()) || force) {
        try {
          const result: ProvinceResult = await this.deps.fetchProvince(id)
          const entry = await putProvince(id, result, this.deps.now(), this.deps.kv)
          this.provinces.set(id, entry)
          this.rebuildStations()
          this.current = { ...this.current, error: undefined }
        } catch (err) {
          if (!cached) {
            this.current = { ...this.current, error: err instanceof Error ? err.message : String(err) }
          }
        }
      }
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
