import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf-8')

// Innermost `selector { body }` pairs; a media query's own brace never matches
// because its body contains braces.
function rules(source: string): { selector: string; body: string }[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(),
    body: m[2],
  }))
}

function tokens(selector: string): Map<string, string> {
  const rule = rules(css).find((r) => r.selector === selector)
  if (!rule) throw new Error(`no ${selector} rule`)
  return new Map([...rule.body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const DARK_SELECTORS = [":root:not([data-theme='light'])", ":root[data-theme='dark']"]

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// OSM's land (#f2efe9) and residential (#e0dfdf) fills once through the dark
// tile filter, measured from the CSS filter matrices: where the pins sit.
const DARK_BASEMAP = ['#1b1914', '#262525']

describe('dark map', () => {
  it('darkens the basemap in system dark and in forced dark alike', () => {
    for (const selector of DARK_SELECTORS) {
      expect(tokens(selector).get('--map-tile-filter')).toMatch(/invert\(1\) hue-rotate\(180deg\)/)
    }
    expect(tokens(':root').get('--map-tile-filter')).toBe('none')
  })

  it('filters the tiles only, never markers, popups, controls or the attribution', () => {
    const filtered = rules(css).filter((r) => /(^|;|\s)filter:/.test(r.body))
    expect(filtered.map((r) => r.selector)).toEqual(['.leaflet-tile-pane'])
    expect(filtered[0].body).toContain('var(--map-tile-filter)')
  })

  it('keeps every pin fill at 3:1 against the darkened basemap', () => {
    for (const selector of DARK_SELECTORS) {
      const dark = new Map([...tokens(':root'), ...tokens(selector)])
      for (const kind of ['cheap', 'mid', 'expensive', 'unknown', 'user', 'services']) {
        const fill = dark.get(`--map-marker-${kind}`)!
        for (const ground of DARK_BASEMAP) {
          expect(contrast(fill, ground), `${kind} ${fill} on ${ground}`).toBeGreaterThanOrEqual(3)
        }
        // The pump glyph is drawn in white on the fill.
        expect(contrast(fill, '#ffffff'), `white on ${kind}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
