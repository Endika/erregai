import type { PaneView } from '../app/pane-view'
import { t } from '../i18n'

const VIEWS: readonly PaneView[] = ['stations', 'radars']

let switchSeq = 0

// Native radios: one of two views, with arrow keys and "1 of 2" for free. Each
// label's text is the drawn segment, so the input stays focusable but unseen.
export function renderPaneSwitch(
  current: PaneView,
  radarCount: number,
  onSelect: (view: PaneView) => void,
): HTMLElement {
  const group = document.createElement('fieldset')
  group.className = 'pane-switch'
  const legend = document.createElement('legend')
  legend.className = 'visually-hidden'
  legend.textContent = t('pane.label')
  group.appendChild(legend)

  const name = `pane-switch-${++switchSeq}`
  for (const view of VIEWS) {
    const option = document.createElement('label')
    option.className = 'pane-switch__option'
    const input = document.createElement('input')
    input.type = 'radio'
    input.name = name
    input.value = view
    input.checked = view === current
    input.className = 'pane-switch__input'
    input.addEventListener('change', () => {
      if (input.checked) onSelect(view)
    })
    const text = document.createElement('span')
    text.className = 'pane-switch__text'
    text.textContent =
      view === 'stations'
        ? t('nav.stations')
        : t('pane.radars').replace('{count}', String(radarCount))
    option.append(input, text)
    group.appendChild(option)
  }
  return group
}
