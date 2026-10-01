import { t } from '../i18n'
import type { SortKey } from '../core/pricing'
import { COMMON_FUELS, FUELS, type FuelId } from '../core/fuels'

const SORT_KEYS: readonly SortKey[] = ['price', 'distance']
const SVG_NS = 'http://www.w3.org/2000/svg'

export interface FuelControl {
  current: FuelId
  onChange: (fuel: FuelId) => void
}

let fuelSelectSeq = 0

export function renderSortBar(
  current: SortKey,
  onSelect: (key: SortKey) => void,
  fuel: FuelControl,
): HTMLElement {
  const bar = document.createElement('div')
  bar.className = 'sort-bar'
  bar.appendChild(renderFuelControl(fuel))
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

// A native select: the phone's own picker is one-handed and accessible, and
// the optgroups keep the four usual fuels ahead of the rare ones.
export function renderFuelControl(fuel: FuelControl): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'sort-bar__fuel'

  const id = `sort-bar-fuel-${++fuelSelectSeq}`
  const label = document.createElement('label')
  label.className = 'visually-hidden'
  label.htmlFor = id
  label.textContent = t('settings.fuel')

  const select = document.createElement('select')
  select.id = id
  select.className = 'sort-bar__fuel-select'
  const others = FUELS.map((f) => f.id).filter((f) => !COMMON_FUELS.includes(f))
  select.append(
    fuelGroup(t('fuel.group.common'), COMMON_FUELS),
    fuelGroup(t('fuel.group.other'), others),
  )
  select.value = fuel.current
  select.addEventListener('change', () => fuel.onChange(select.value as FuelId))

  wrap.append(label, select, chevron())
  return wrap
}

function fuelGroup(name: string, ids: readonly FuelId[]): HTMLOptGroupElement {
  const group = document.createElement('optgroup')
  group.label = name
  for (const id of ids) {
    const option = document.createElement('option')
    option.value = id
    option.textContent = t(`fuel.${id}`)
    group.appendChild(option)
  }
  return group
}

function chevron(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'sort-bar__fuel-chevron')
  svg.setAttribute('viewBox', '0 0 12 12')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M2.5 4.5 6 8l3.5-3.5')
  svg.appendChild(path)
  return svg
}
