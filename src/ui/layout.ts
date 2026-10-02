// Mirrors the `@media (min-width: 64rem)` block in styles.css: a list pane of
// 24–28rem beside a map still at least ~38rem wide. Narrower, the map would be
// a strip, so tablets in portrait keep the phone layout.
export const DESKTOP_QUERY = '(min-width: 64rem)'

export type CardHost = 'sheet' | 'pane' | 'overlay'
export type LayoutTab = 'list' | 'map' | 'trip' | 'settings'

// Where the station card opens. On a phone it is the bottom sheet. On a desktop
// it takes the list pane's place on List and Map, leaving the map whole; on Trip
// that pane holds the alerts and Stop, so it floats over the map instead.
export function cardHost(tab: LayoutTab, desktop: boolean): CardHost {
  if (!desktop) return 'sheet'
  return tab === 'list' || tab === 'map' ? 'pane' : 'overlay'
}

// Calls back on every crossing of the breakpoint, and returns the current answer.
// Without matchMedia (tests, very old engines) it is the phone layout.
export function watchDesktop(
  win: Pick<Window, 'matchMedia'>,
  onChange: (desktop: boolean) => void,
): () => boolean {
  const query = typeof win.matchMedia === 'function' ? win.matchMedia(DESKTOP_QUERY) : undefined
  query?.addEventListener('change', (e) => onChange(e.matches))
  return () => query?.matches ?? false
}

// The nav is the bottom bar on a phone, last in the shell; on a desktop it joins
// the header, so keyboard order reaches the tabs before a long list, not after.
export function placeNav(nav: HTMLElement, desktop: boolean, header: HTMLElement): void {
  if (desktop) {
    // Right after the title.
    if (nav.parentElement !== header)
      header.insertBefore(nav, header.firstElementChild?.nextElementSibling ?? null)
  } else {
    const shell = header.parentElement
    if (shell && shell.lastElementChild !== nav) shell.appendChild(nav)
  }
}
