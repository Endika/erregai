export type Politeness = 'polite' | 'assertive'
export type Announce = (text: string, politeness: Politeness) => void

// Enough to cover the alerts one GPS fix can raise at once.
const KEPT_MESSAGES = 3

// The views are rebuilt on every render, and a live region created with its
// text already in place is often never voiced. These two regions live outside
// that tree for the whole session; each message is a new node, so a repeat of
// the same words is still an addition the screen reader picks up.
export function createAnnouncer(host: HTMLElement): Announce {
  const regions: Record<Politeness, HTMLElement> = {
    polite: liveRegion('polite'),
    assertive: liveRegion('assertive'),
  }
  host.append(regions.polite, regions.assertive)
  return (text, politeness) => {
    const region = regions[politeness]
    const message = document.createElement('p')
    message.textContent = text
    region.appendChild(message)
    while (region.children.length > KEPT_MESSAGES) region.firstElementChild?.remove()
  }
}

function liveRegion(politeness: Politeness): HTMLElement {
  const region = document.createElement('div')
  region.className = 'visually-hidden'
  region.setAttribute('aria-live', politeness)
  region.setAttribute('aria-relevant', 'additions')
  return region
}
