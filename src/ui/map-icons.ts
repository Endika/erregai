import type { ServiceKind } from '../core/services'

// Stroke-only glyphs: at 14–18 px on a coloured disc a filled shape turns into a
// blob, while a 2 px outline still reads as a pump, a camera or a fork.
export type Glyph = 'fuel' | 'camera' | 'cutlery' | 'cup' | 'shop'

const PATHS: Record<Glyph, string> = {
  fuel: 'M7 21V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v16M5 21h12M9 7h4M15 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0v-5',
  camera:
    'M3 8h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM15 12l6-3v6l-6-3M8 18v3M5 21h6',
  cutlery: 'M5.5 3v5a2.5 2.5 0 0 0 5 0V3M8 8v13M16.5 21V3c2 1.5 3 4 3 6.5 0 2-1.2 3.2-3 3.5',
  cup: 'M4 8h11v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8zM15 9h2.5a2.5 2.5 0 0 1 0 5H15M3 21h13',
  shop: 'M4 9h16v11H4V9zM3 9l2-5h14l2 5M9 20v-6h6v6',
}

const SERVICE_GLYPH_PRIORITY: readonly (readonly [ServiceKind, Glyph])[] = [
  ['restaurant', 'cutlery'],
  ['fast_food', 'cutlery'],
  ['cafe', 'cup'],
  ['fuel', 'fuel'],
  ['shop', 'shop'],
]

// One area can offer half a dozen things; the marker shows the one a driver
// picks an exit for. Eating beats refuelling — the fuel layer already covers
// petrol, and `toilets` alone never wins a glyph.
export function serviceGlyph(kinds: readonly ServiceKind[]): Glyph | undefined {
  for (const [kind, glyph] of SERVICE_GLYPH_PRIORITY) {
    if (kinds.includes(kind)) return glyph
  }
  return undefined
}

// Constant markup: every value is a literal or a colour read back from our own
// CSS custom properties, so nothing user- or OSM-supplied reaches innerHTML.
export function glyphSvg(glyph: Glyph, size: number): string {
  return `<svg class="map-glyph" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[glyph]}"/></svg>`
}
