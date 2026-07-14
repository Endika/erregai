import { t } from '../i18n'
import type { SortKey } from '../core/pricing'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']

export function renderSortBar(current: SortKey, onSelect: (key: SortKey) => void): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'sort-bar'
  for (const key of SORT_KEYS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sort-bar__btn'
    btn.classList.toggle('is-active', key === current)
    btn.setAttribute('aria-pressed', String(key === current))
    btn.textContent = t(`sort.${key}`)
    btn.addEventListener('click', () => onSelect(key))
    bar.appendChild(btn)
  }
  return bar
}
