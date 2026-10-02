import type { BestChoice } from '../core/best-choice'
import type { FuelId } from '../core/fuels'
import { stationBand, type PriceReference } from '../core/pricing'
import type { Station } from '../core/station'
import { t } from '../i18n'
import { formatEuros, formatKm, formatNumber, formatPrice } from '../i18n/format'
import { mapsUrl } from './detail'

export interface AnswerCardOptions {
  fuel: FuelId
  // The radius reference the rows band against, so the card never disagrees.
  reference?: PriceReference
  tankLitres: number
  onSelect: (s: Station) => void
}

function span(className: string, text?: string): HTMLSpanElement {
  const el = document.createElement('span')
  el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

function savingLine(choice: BestChoice, tankLitres: number): string {
  if (choice.kind === 'nearest') return t('answer.nearest')
  if (choice.kind === 'only') return t('answer.only')
  return t('answer.saving')
    .replace('{amount}', formatEuros(choice.saving ?? 0))
    .replace('{litres}', formatNumber(tankLitres))
}

// A link cannot sit inside a button, so the tappable body and the directions
// are siblings under one named region.
export function renderAnswerCard(
  choice: BestChoice,
  { fuel, reference, tankLitres, onSelect }: AnswerCardOptions,
): HTMLElement {
  const { station, price, distanceKm } = choice
  const card = document.createElement('section')
  card.className = 'answer-card'
  const label = t(choice.kind === 'saving' ? 'answer.label.saving' : 'answer.label')
    .replace('{brand}', station.brand)
    .replace('{price}', formatPrice(price))
    .replace('{amount}', formatEuros(choice.saving ?? 0))
  card.setAttribute('aria-label', label)

  const status = span(
    'answer-card__status',
    t(choice.closingSoon ? 'schedule.closingSoon' : 'answer.open'),
  )
  status.dataset.schedule = choice.closingSoon ? 'closing-soon' : 'open'
  const head = span('answer-card__head')
  head.append(span('answer-card__brand', station.brand), status)

  const figures = span('answer-card__figures')
  const priceEl = span('answer-card__price', `${formatPrice(price)} `)
  priceEl.appendChild(span('answer-card__unit', '€/l'))
  figures.appendChild(priceEl)
  const band = stationBand(station, fuel, reference)
  if (band) {
    figures.dataset.band = band
    figures.appendChild(span('answer-card__band', t(`band.${band}`)))
  }
  const distance = span('answer-card__distance', `${formatKm(distanceKm)} `)
  distance.appendChild(span('answer-card__distance-note', t('detail.distance.straightLine')))
  figures.appendChild(distance)

  const body = document.createElement('button')
  body.type = 'button'
  body.className = 'answer-card__body'
  body.append(head, figures, span('answer-card__saving', savingLine(choice, tankLitres)))
  body.addEventListener('click', () => onSelect(station))

  const directions = document.createElement('a')
  directions.className = 'answer-card__directions'
  directions.href = mapsUrl(station)
  directions.target = '_blank'
  directions.rel = 'noopener noreferrer'
  directions.textContent = t('detail.directions')

  card.append(body, directions)
  return card
}
