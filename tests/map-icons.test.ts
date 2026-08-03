import { glyphSvg, serviceGlyph } from '../src/ui/map-icons'
import { SERVICE_AREAS } from '../src/core/services.data'

describe('serviceGlyph', () => {
  it('picks what a driver takes the exit for, not the first tag', () => {
    expect(serviceGlyph(['fuel', 'restaurant'])).toBe('cutlery')
    expect(serviceGlyph(['shop', 'cafe'])).toBe('cup')
    expect(serviceGlyph(['toilets', 'fuel'])).toBe('fuel')
  })

  it('treats fast food as a place to eat', () => {
    expect(serviceGlyph(['fast_food'])).toBe('cutlery')
  })

  // 161 of the 996 baked areas have nothing glyph-worthy tagged; those must fall
  // back to the plain square rather than claim an amenity OSM never recorded.
  it('claims nothing for an area with no glyph-worthy amenity', () => {
    expect(serviceGlyph([])).toBeUndefined()
    expect(serviceGlyph(['toilets'])).toBeUndefined()
  })

  it('resolves every kind combination in the baked dataset', () => {
    for (const area of SERVICE_AREAS) {
      expect(() => serviceGlyph(area.services)).not.toThrow()
    }
  })
})

describe('glyphSvg', () => {
  it('emits a sized, decorative svg for each glyph', () => {
    const svg = glyphSvg('camera', 16)
    expect(svg).toContain('width="16"')
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toMatch(/<path d="M[\d.]/)
  })
})
