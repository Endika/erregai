// @vitest-environment jsdom
import { createAnnouncer } from '../src/ui/announcer'

describe('announcer', () => {
  beforeEach(() => document.body.replaceChildren())

  it('creates one polite and one assertive region, once', () => {
    const host = document.createElement('div')
    createAnnouncer(host)
    expect(host.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)
    expect(host.querySelectorAll('[aria-live="assertive"]')).toHaveLength(1)
  })

  it('voices each message in the region of its urgency', () => {
    const host = document.createElement('div')
    const announce = createAnnouncer(host)
    announce('Radar a 300 m', 'assertive')
    announce('Gasolinera cerca', 'polite')
    expect(host.querySelector('[aria-live="assertive"]')!.textContent).toBe('Radar a 300 m')
    expect(host.querySelector('[aria-live="polite"]')!.textContent).toBe('Gasolinera cerca')
  })

  it('adds a new node per message so a repeat is voiced again, keeping only the latest few', () => {
    const host = document.createElement('div')
    const announce = createAnnouncer(host)
    for (let i = 0; i < 6; i++) announce('Radar a 300 m', 'assertive')
    const region = host.querySelector('[aria-live="assertive"]')!
    expect(region.children.length).toBeGreaterThan(1)
    expect(region.children.length).toBeLessThanOrEqual(3)
  })
})
