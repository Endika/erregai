// @vitest-environment jsdom
import { renderBandLegend, renderList } from '../src/ui/list'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { radarAlertLabel, renderRadarList } from '../src/ui/radar-list'
import { setLocale, t } from '../src/i18n'
import type { Radar, RadarHit } from '../src/core/radars'
import type { Station } from '../src/core/station'

const s = (id: string, price: number): Station => ({
  id,
  brand: 'REPSOL',
  name: 'REPSOL',
  pos: { lat: 40, lon: -3 },
  address: '',
  town: 'Madrid',
  schedule: '',
  prices: { gasoleoA: price },
})

describe('renderList', () => {
  it('renders a row per station with band attribute and price', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.2), s('2', 1.6)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const rows = el.querySelectorAll('[data-station]')
    expect(rows.length).toBe(2)
    expect(el.textContent).toContain('1,200')
    expect(rows[0].getAttribute('data-band')).toBe('cheap')
  })

  it('formats prices and distances for the active locale', () => {
    const el = document.createElement('div')
    const far = { ...s('1', 1.739), pos: { lat: 40.0112, lon: -3 } }
    setLocale('en')
    renderList(el, [far], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    expect(el.querySelector('.station-row__price-value')?.textContent).toBe('1.739')
    expect(el.querySelector('.station-row__distance')?.textContent).toBe('1.2 km')
    setLocale('eu')
    renderList(el, [far], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    expect(el.querySelector('.station-row__price-value')?.textContent).toBe('1,739')
    expect(el.querySelector('.station-row__distance')?.textContent).toBe('1,2 km')
    setLocale('es')
  })

  it('voices the price followed by its band, not the band alone', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.739), s('2', 1.9)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const price = el.querySelector('.station-row__price')!
    expect(price.getAttribute('aria-label')).toBe('1,739 €/l, barata')
    expect(price.getAttribute('title')).toBe('Barata')
  })

  it('puts the brand and the price on the first line', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.739)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const row = el.querySelector('.station-row')!
    const [head, meta] = [...row.children]
    expect(head.className).toBe('station-row__head')
    expect([...head.children].map((c) => c.className)).toEqual([
      'station-row__brand',
      'station-row__price',
    ])
    expect(meta.className).toBe('station-row__meta')
  })

  it('shows the unit in the pill without voicing it twice', () => {
    const el = document.createElement('div')
    renderList(el, [s('1', 1.739)], 'gasoleoA', { lat: 40, lon: -3 }, () => {})
    const unit = el.querySelector('.station-row__price .station-row__price-unit')!
    expect(unit.textContent).toBe('€/l')
    expect(unit.getAttribute('aria-hidden')).toBe('true')
  })

  it('puts the town, the distance and the schedule on the second line', () => {
    const el = document.createElement('div')
    const closed = { ...s('1', 1.739), schedule: 'L-D: 06:00-22:00' }
    renderList(el, [closed], 'gasoleoA', { lat: 40, lon: -3 }, () => {}, {
      now: new Date(2026, 0, 7, 23, 30),
    })
    const meta = el.querySelector('.station-row__meta')!
    const parts = [...meta.children].filter((c) => c.getAttribute('aria-hidden') !== 'true')
    expect(parts.map((c) => c.className)).toEqual([
      'station-row__town',
      'station-row__distance',
      'station-row__schedule',
    ])
    expect(meta.textContent).toBe('Madrid·0,0 kmCerrado ahora')
  })
})

describe('renderBandLegend', () => {
  it('names the reference the colours compare against, then the three bands', () => {
    setLocale('es')
    const el = renderBandLegend(15)
    const summary = el.querySelector('summary')!
    expect(summary.querySelector('.band-legend__scope')?.textContent).toBe('En tu radio de 15 km:')
    const items = [...summary.querySelectorAll<HTMLElement>('.legend__item')]
    expect(items.map((i) => i.dataset.band)).toEqual(['cheap', 'mid', 'expensive'])
    expect(summary.textContent).toBe('En tu radio de 15 km: Barata Media Cara')
  })

  it('opens to the same explanation Settings gives, closed by default', () => {
    setLocale('es')
    const el = renderBandLegend(15)
    expect(el.tagName).toBe('DETAILS')
    expect((el as HTMLDetailsElement).open).toBe(false)
    expect(el.querySelector('.band-legend__about')?.textContent).toBe(t('band.legend.about'))
  })

  // Every distance is haversine; said once here rather than on every row.
  it('says once that the radius and the distances are straight-line', () => {
    setLocale('es')
    const notes = [...renderBandLegend(15).querySelectorAll('.band-legend__about')]
    expect(notes.map((n) => n.textContent)).toEqual([
      t('band.legend.about'),
      'El radio y las distancias se miden en línea recta, no por carretera.',
    ])
    const list = document.createElement('div')
    renderList(list, [s('a', 1.5)], 'gasoleoA', { lat: 40.1, lon: -3 }, () => {})
    expect(list.textContent).not.toContain('línea recta')
  })

  it('stays open across re-renders once the reader opened it', () => {
    const first = renderBandLegend(15) as HTMLDetailsElement
    first.open = true
    first.dispatchEvent(new Event('toggle'))
    expect((renderBandLegend(15) as HTMLDetailsElement).open).toBe(true)
    first.open = false
    first.dispatchEvent(new Event('toggle'))
    expect((renderBandLegend(15) as HTMLDetailsElement).open).toBe(false)
  })

  it('follows the locale and the radius', () => {
    setLocale('en')
    expect(renderBandLegend(50).querySelector('summary')!.textContent).toBe(
      'Within your 50 km radius: Cheap Mid Expensive',
    )
    setLocale('es')
  })
})

describe('row delta against the radius average', () => {
  const ORIGIN = { lat: 40, lon: -3 }
  const draw = (prices: number[]) => {
    const el = document.createElement('div')
    renderList(
      el,
      prices.map((p, i) => s(String(i), p)),
      'gasoleoA',
      ORIGIN,
      () => {},
    )
    return [...el.querySelectorAll<HTMLElement>('.station-row')]
  }

  it('says in words how far each price sits from the average, last on the second line', () => {
    setLocale('es')
    const rows = draw([1.2, 1.4, 1.6])
    const deltas = rows.map((r) => r.querySelector('.station-row__meta > :last-child')?.textContent)
    expect(deltas).toEqual(['\u221220 cént.', 'en la media', '+20 cént.'])
    for (const row of rows) {
      expect(row.querySelector('.station-row__delta')!.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('adds the delta to what the price pill voices', () => {
    setLocale('es')
    const rows = draw([1.2, 1.3, 1.4, 1.5, 1.5, 1.5])
    const label = (r: HTMLElement) =>
      r.querySelector('.station-row__price')!.getAttribute('aria-label')
    expect([rows[0], rows[2], rows[5]].map(label)).toEqual([
      '1,200 €/l, barata, 20 céntimos por debajo de la media',
      '1,400 €/l, media, en la media',
      '1,500 €/l, cara, 10 céntimos por encima de la media',
    ])
  })

  it('uses the singular for one céntimo', () => {
    setLocale('es')
    const rows = draw([1.39, 1.4, 1.41])
    expect(rows[0].querySelector('.station-row__price')!.getAttribute('aria-label')).toBe(
      '1,390 €/l, barata, 1 céntimo por debajo de la media',
    )
    setLocale('en')
    const en = draw([1.39, 1.4, 1.45])
    expect(en[0].querySelector('.station-row__delta')!.textContent).toBe('\u22122 ct')
    expect(en[0].querySelector('.station-row__price')!.getAttribute('aria-label')).toBe(
      '1.390 €/l, cheap, 2 cents below the average',
    )
    setLocale('es')
  })

  it('stays out when too few prices make an average meaningless', () => {
    const rows = draw([1.2, 1.6])
    expect(rows.every((r) => r.querySelector('.station-row__delta') === null)).toBe(true)
  })
})

describe('renderRadarList', () => {
  const hit = (id: string, distanceKm: number): RadarHit =>
    ({ radar: { id, via: `N-${id}`, lat: 0, lon: 0 }, distanceKm }) as RadarHit

  it('shows metres under a kilometre and kilometres from there on', () => {
    setLocale('es')
    const el = renderRadarList([hit('1', 0.42), hit('2', 1.26)], 'radar.list.title', 5)
    const distances = [...el.querySelectorAll('.radar-list__distance')].map((d) => d.textContent)
    expect(distances).toEqual(['420 m', '1,3 km'])
  })
  // Seven rows of "A-8" are only told apart by where each one lies from here.
  it('says how far and toward which compass point each radar lies from the origin', () => {
    setLocale('es')
    const origin = { lat: 43, lon: -3 }
    const at = (id: string, lat: number, lon: number, distanceKm: number): RadarHit =>
      ({ radar: { id, via: 'A-8', lat, lon }, distanceKm }) as RadarHit
    const el = renderRadarList(
      [at('n', 43.02, -3, 2.2), at('se', 42.99, -2.985, 1.6), at('w', 43, -3.03, 2.5)],
      'radar.nearby.title',
      5,
      origin,
    )
    const rows = [...el.querySelectorAll('.radar-list__row')].map((r) => [
      r.querySelector('.radar-list__via')?.textContent,
      r.querySelector('.radar-list__distance')?.textContent,
    ])
    expect(rows).toEqual([
      ['A-8', '2,2 km al norte'],
      ['A-8', '1,6 km al sureste'],
      ['A-8', '2,5 km al oeste'],
    ])
  })

  it("names the compass point in the reader's language", () => {
    setLocale('eu')
    const el = renderRadarList(
      [{ radar: { id: 'e', via: 'A-8', lat: 43, lon: -2.97 }, distanceKm: 2.4 } as RadarHit],
      'radar.nearby.title',
      5,
      { lat: 43, lon: -3 },
    )
    expect(el.querySelector('.radar-list__distance')?.textContent).toBe(
      t('radar.toward.e').replace('{distance}', '2,4 km'),
    )
    setLocale('es')
  })

  it('marks each row with the camera glyph the map uses for radars, hidden from readers', () => {
    const el = renderRadarList([hit('1', 0.42), hit('2', 1.26)], 'radar.list.title', 5)
    const rows = [...el.querySelectorAll('.radar-list__row')]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const icon = row.firstElementChild!
      expect(icon.classList.contains('radar-list__icon')).toBe(true)
      expect(icon.getAttribute('aria-hidden')).toBe('true')
      expect(icon.querySelector('svg.map-glyph')).not.toBeNull()
    }
  })
})

describe('radar rows with a PK and a direction', () => {
  const origin = { lat: 43, lon: -3 }
  const row = (extra: Partial<Radar>) => {
    const radar = { id: 'x', via: 'A-8', lat: 42.99, lon: -3.015, source: 'euskadi', ...extra }
    const el = renderRadarList(
      [{ radar, distanceKm: 1.6 } as RadarHit],
      'radar.nearby.title',
      5,
      origin,
    )
    return el.querySelector('.radar-list__row')!
  }
  const text = (el: Element, cls: string) => el.querySelector(`.radar-list__${cls}`)?.textContent

  beforeEach(() => setLocale('es'))

  it('reads road, PK and direction, with the distance and bearing kept apart', () => {
    const r = row({ pk: 112, dir: 'Bilbao' })
    expect(text(r, 'road')).toBe('A-8')
    expect(text(r, 'pk')).toBe('PK 112')
    expect(text(r, 'dir')).toBe('sentido Bilbao')
    expect(text(r, 'via')).toBe('A-8 PK 112 sentido Bilbao')
    expect(text(r, 'distance')).toBe('1,6 km al suroeste')
  })

  it('says only road and PK when the source names no direction', () => {
    const r = row({ pk: 445.35 })
    expect(text(r, 'via')).toBe('A-8 PK 445,4')
    expect(r.querySelector('.radar-list__dir')).toBeNull()
  })

  it("keeps today's row without a PK", () => {
    const r = row({ dir: 'Bilbao' })
    expect(text(r, 'via')).toBe('A-8')
    expect(r.querySelector('.radar-list__via--pk')).toBeNull()
    expect(r.querySelector('.radar-list__dir')).toBeNull()
  })

  it('names a direction along the PK', () => {
    expect(text(row({ pk: 3.97, dir: 'creciente' }), 'dir')).toBe('sentido creciente')
    expect(text(row({ pk: 3.97, dir: 'decreciente' }), 'dir')).toBe('sentido decreciente')
  })

  it('writes the PK with at most one decimal and no thousands separator', () => {
    expect(text(row({ pk: 1106.18 }), 'pk')).toBe('PK 1106,2')
    setLocale('en')
    expect(text(row({ pk: 1106.18 }), 'pk')).toBe('km 1106.2')
  })

  it('in Basque, puts the destination first as Trafikoa does', () => {
    setLocale('eu')
    expect(text(row({ pk: 123.5, dir: 'Bilbao' }), 'dir')).toBe(
      t('radar.dir.to').replace('{place}', 'Bilbao'),
    )
  })

  // One line when it fits; at 390px the direction drops below and only it is cut
  // short, with the separator dot clipped at the start of the line.
  it('never cuts the road or the PK, only the direction', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../src/styles.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    // Every declaration aimed at a selector, across the rules that list it.
    const rule = (sel: string) =>
      [...css.matchAll(/\n([^{}\n][^{}]*)\{([^}]*)\}/g)]
        .filter((m) => m[1].split(',').some((s) => s.trim() === sel))
        .map((m) => m[2])
        .join('')
    expect(rule('.radar-list__via--pk')).toMatch(/flex-wrap: wrap/)
    for (const part of ['.radar-list__road', '.radar-list__pk']) {
      expect(rule(part)).toMatch(/flex: none/)
      expect(rule(part)).toMatch(/white-space: nowrap/)
    }
    expect(rule('.radar-list__dir')).toMatch(/min-width: 0/)
    expect(rule('.radar-list__dir')).toMatch(/max-width: 100%/)
    expect(rule('.radar-list__dir-text')).toMatch(/text-overflow: ellipsis/)
  })
})

describe('radarAlertLabel', () => {
  const radar = (limit?: number): Radar => ({
    id: 'r',
    lat: 0,
    lon: 0,
    via: 'A-2',
    source: 'catalunya',
    ...(limit !== undefined && { limit }),
  })

  it('adds the speed limit when the source publishes one', () => {
    setLocale('es')
    expect(radarAlertLabel(radar(120))).toBe('Radar fijo en A-2 · 120 km/h')
  })

  it('keeps the plain label without one', () => {
    setLocale('es')
    expect(radarAlertLabel(radar())).toBe('Radar fijo en A-2')
  })
})
