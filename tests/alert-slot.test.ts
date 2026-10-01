// @vitest-environment jsdom
import {
  composeSlot,
  fuelKey,
  radarKey,
  renderSlot,
  renderSlotArea,
  slotId,
  type SlotAlert,
} from '../src/ui/alert-slot'
import { setLocale, t } from '../src/i18n'

const radar: SlotAlert = { kind: 'radar', key: 'Radar · 600 m', label: 'Radar fijo en A-2' }
const cheapest: SlotAlert = {
  kind: 'cheapest',
  key: 'REPSOL 1,329 · 1,4 km',
  label: 'Más barata en Gasóleo A por delante',
}
const nearby: SlotAlert = { kind: 'fuel', key: 'EROSKI 1,349 · 900 m', label: 'Gasolinera cerca' }

beforeEach(() => setLocale('es'))

describe('composeSlot', () => {
  it('is empty without alerts', () => {
    expect(composeSlot([])).toBeUndefined()
  })

  it('leads with the radar, then the cheapest, then the nearby station, whatever the input order', () => {
    expect(composeSlot([nearby, cheapest, radar])).toEqual({
      primary: radar,
      more: [cheapest, nearby],
    })
    expect(composeSlot([nearby, cheapest])).toEqual({ primary: cheapest, more: [nearby] })
    expect(composeSlot([nearby])).toEqual({ primary: nearby, more: [] })
  })
})

describe('renderSlot', () => {
  it('shows one alert in full and collapses the rest into a single line', () => {
    const el = renderSlot({ primary: radar, more: [cheapest] })
    const banners = el.querySelectorAll('.trip-view__banner')
    expect(banners).toHaveLength(1)
    expect(banners[0].classList.contains('trip-view__banner--radar')).toBe(true)
    expect(banners[0].querySelector('.trip-view__banner-key')!.textContent).toBe('Radar · 600 m')
    expect(banners[0].querySelector('.trip-view__banner-label')!.textContent).toBe(
      'Radar fijo en A-2',
    )
    const more = el.querySelectorAll('.trip-view__alerts-more')
    expect(more).toHaveLength(1)
    expect(more[0].textContent).toBe(`+ ${t('trip.slot.more.cheapest')}: REPSOL 1,329 · 1,4 km`)
  })

  it('has no secondary line when only one alert is active', () => {
    const el = renderSlot({ primary: nearby, more: [] })
    expect(el.querySelector('.trip-view__alerts-more')).toBeNull()
  })
})

describe('alert key lines', () => {
  it('reads WHAT · DISTANCE for a radar', () => {
    expect(radarKey(0.6032)).toBe('Radar · 600 m')
  })

  it('names brand and price before the distance for a station', () => {
    expect(fuelKey('REPSOL', 1.329, 1.437)).toBe('REPSOL 1,329 · 1,4 km')
    expect(fuelKey('EROSKI', 1.349, 0.9036)).toBe('EROSKI 1,349 · 900 m')
  })
})

describe('renderSlotArea', () => {
  const station: SlotAlert = { ...cheapest, id: 'repsol-1', brand: 'REPSOL' }

  it('keeps the key text whole while the brand can be cut on its own', () => {
    const el = renderSlotArea({ primary: station, more: [] })
    const key = el.querySelector('.trip-view__banner-key')!
    expect(key.textContent).toBe('REPSOL 1,329 · 1,4 km')
    expect(key.querySelector('.trip-view__banner-brand')!.textContent).toBe('REPSOL')
  })

  it('fades in only an alert that was not on screen before', () => {
    const entering = (el: HTMLElement) => el.classList.contains('trip-view__slot--enter')
    expect(entering(renderSlotArea({ primary: station, more: [] }, { entering: true }))).toBe(true)
    expect(entering(renderSlotArea({ primary: station, more: [] }))).toBe(false)
  })
})

describe('slotId', () => {
  it('names the alert in the slot, not its distance', () => {
    const near = { ...radar, id: 'dgt-0', key: 'Radar · 400 m' }
    const far = { ...radar, id: 'dgt-0', key: 'Radar · 600 m' }
    const next = { ...radar, id: 'dgt-1', key: 'Radar · 800 m' }
    expect(slotId({ primary: near, more: [] })).toBe(slotId({ primary: far, more: [] }))
    expect(slotId({ primary: near, more: [] })).not.toBe(slotId({ primary: next, more: [] }))
    expect(slotId(undefined)).toBe('')
  })
})
