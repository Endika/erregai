// @vitest-environment jsdom
import { loadPaneView, savePaneView } from '../src/app/pane-view'

describe('pane view', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('starts on the stations and remembers a pick for the session', () => {
    expect(loadPaneView()).toBe('stations')
    savePaneView('radars')
    expect(loadPaneView()).toBe('radars')
  })

  it('falls back to the stations where storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(() => savePaneView('radars', broken)).not.toThrow()
    expect(loadPaneView(broken)).toBe('stations')
  })
})
