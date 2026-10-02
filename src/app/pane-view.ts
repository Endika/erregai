export type PaneView = 'stations' | 'radars'

const KEY = 'erregai.paneView'

// For this visit only: a new one starts on the stations, the app's main answer.
// Reaching sessionStorage itself throws where site data is blocked.
export function loadPaneView(store?: Storage): PaneView {
  try {
    return (store ?? window.sessionStorage).getItem(KEY) === 'radars' ? 'radars' : 'stations'
  } catch {
    return 'stations'
  }
}

export function savePaneView(view: PaneView, store?: Storage): void {
  try {
    ;(store ?? window.sessionStorage).setItem(KEY, view)
  } catch {
    /* storage blocked: the choice lasts until the page reloads */
  }
}
