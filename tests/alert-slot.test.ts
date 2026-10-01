// @vitest-environment jsdom
import { composeSlot, fuelKey, radarKey, renderSlot, type SlotAlert } from '../src/ui/alert-slot'
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
