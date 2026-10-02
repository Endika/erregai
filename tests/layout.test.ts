// @vitest-environment jsdom
import { DESKTOP_QUERY, cardHost, placeNav, watchDesktop } from '../src/ui/layout'

type Listener = (e: { matches: boolean }) => void

function fakeMatchMedia(initial: boolean): {
  win: Pick<Window, 'matchMedia'>
  cross: (matches: boolean) => void
  queries: string[]
} {
  const listeners: Listener[] = []
  const queries: string[] = []
  const query = {
    matches: initial,
    addEventListener: (_type: string, listener: Listener) => listeners.push(listener),
  }
  const win = {
    matchMedia: (q: string) => {
      queries.push(q)
      return query as unknown as MediaQueryList
    },
  }
  const cross = (matches: boolean): void => {
    query.matches = matches
    for (const listener of listeners) listener({ matches })
  }
  return { win, cross, queries }
}

describe('cardHost', () => {
  it('is the bottom sheet on every phone tab', () => {
    for (const tab of ['list', 'map', 'trip', 'settings'] as const)
      expect(cardHost(tab, false)).toBe('sheet')
  })

  it('takes the list pane on a desktop List and Map, leaving the map whole', () => {
    expect(cardHost('list', true)).toBe('pane')
    expect(cardHost('map', true)).toBe('pane')
  })

  it('floats over the map on a desktop Trip, whose pane holds the alerts and Stop', () => {
    expect(cardHost('trip', true)).toBe('overlay')
    expect(cardHost('settings', true)).toBe('overlay')
  })
})

describe('watchDesktop', () => {
  it('asks the same query as the stylesheet and reports its current answer', () => {
    const { win, queries } = fakeMatchMedia(true)
    const isDesktop = watchDesktop(win, () => {})
    expect(queries).toEqual([DESKTOP_QUERY])
    expect(DESKTOP_QUERY).toBe('(min-width: 64rem)')
    expect(isDesktop()).toBe(true)
  })

  it('calls back on each crossing and follows it', () => {
    const { win, cross } = fakeMatchMedia(false)
    const seen: boolean[] = []
    const isDesktop = watchDesktop(win, (desktop) => seen.push(desktop))
    cross(true)
    expect(isDesktop()).toBe(true)
    cross(false)
    expect(seen).toEqual([true, false])
    expect(isDesktop()).toBe(false)
  })

  it('falls back to the phone layout without matchMedia', () => {
    const isDesktop = watchDesktop({} as Pick<Window, 'matchMedia'>, () => {})
    expect(isDesktop()).toBe(false)
  })
})

describe('placeNav', () => {
  function shell(): { app: HTMLElement; header: HTMLElement; nav: HTMLElement } {
    document.body.innerHTML = `
      <div id="app">
        <header><span data-title></span><time></time><button></button></header>
        <main></main>
        <aside></aside>
        <nav></nav>
      </div>`
    return {
      app: document.getElementById('app')!,
      header: document.querySelector('header')!,
      nav: document.querySelector('nav')!,
    }
  }

  it('moves the nav right after the title on a desktop, before the view in tab order', () => {
    const { header, nav } = shell()
    placeNav(nav, true, header)
    expect(nav.parentElement).toBe(header)
    expect(nav.previousElementSibling?.hasAttribute('data-title')).toBe(true)
    expect(nav.nextElementSibling?.tagName).toBe('TIME')
  })

  it('puts it back as the last bar of the shell on a phone', () => {
    const { app, header, nav } = shell()
    placeNav(nav, true, header)
    placeNav(nav, false, header)
    expect(app.lastElementChild).toBe(nav)
    expect(header.querySelector('nav')).toBeNull()
  })

  it('leaves the nav where it is when it already is in place', () => {
    const { app, header, nav } = shell()
    placeNav(nav, false, header)
    expect(app.lastElementChild).toBe(nav)
    placeNav(nav, true, header)
    placeNav(nav, true, header)
    expect(header.querySelectorAll('nav')).toHaveLength(1)
  })
})
