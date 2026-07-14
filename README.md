# Erregai

Nearby Spanish fuel stations with live prices — offline-first PWA, no backend, no tracking.

**[Try it now →](https://endika.github.io/erregai/)**

Erregai ("fuel" in Basque) locates fuel stations near you, shows prices per fuel type,
colour-codes them cheap/mid/expensive against the local province average, and can watch
the road ahead during a drive and nudge you toward a cheaper station before you pass it.

## Features

- **List & map views** of nearby stations, sortable by price or distance, with a
  colour cue (cheap / mid / expensive) computed from same-province prices.
- **Station detail** with full per-fuel pricing and a one-tap link to open the station
  in your maps app.
- **Trip mode**: while the app is open and in the foreground, it tracks your heading and
  alerts you when a cheaper station appears ahead within your configured radius. It does
  **not** run in the background — see the caveat below.
- **Configurable default fuel** and trip radius, persisted locally.
- **Offline-first**: station data is cached in IndexedDB per province and served stale
  when the network is unavailable; the app itself is installable and works fully offline
  once loaded.
- **Spanish and English**, following the browser/device language.

## Data source & attribution

Station and price data comes from the public REST API of the Spanish
**[Ministerio para la Transición Ecológica y el Reto Demográfico](https://www.mites.gob.es/)**
("Sede Electrónica del Ministerio para la Transición Ecológica"), fetched live per
province — there is no backend, no proxy, and no third-party data resale. Map tiles are
© [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Erregai is an
independent client and is not affiliated with or endorsed by the Ministerio.

## Trip mode caveat

Trip mode only works **while Erregai is open in the foreground**. Mobile browsers
suspend background tabs and throttle or stop geolocation once the app loses focus, so
there is no reliable way to keep tracking your position or firing alerts when the screen
is off or another app is active. If the browser or OS revokes location access mid-trip,
the app degrades gracefully (trip mode stops and tells you why) rather than failing
silently.

## Privacy

- Your GPS position **never leaves the device** — it is only used locally to sort/filter
  stations and to compute trip-mode alerts, and is never sent to any server.
- There is **no backend**: the only network calls are the direct, read-only requests to
  the Ministerio price API (per province) and to OpenStreetMap for map tiles.
- **No tracking, no analytics, no accounts.** Settings (default fuel, trip radius) are
  stored locally in `localStorage`; station data is cached locally in IndexedDB.

## Development

```bash
npm install
npm run dev         # local dev server
npm run build       # typecheck + production build (dist/)
npm run lint         # ESLint
npm run typecheck    # TypeScript, no emit
npm test             # Vitest unit/integration tests
```

## Tech stack

- TypeScript, vanilla — no UI framework
- [Leaflet](https://leafletjs.com/) for the map view, tiled from OpenStreetMap
- Vite + `vite-plugin-pwa` (installable manifest, Workbox service worker: `NetworkFirst`
  for the price API with an offline fallback, `CacheFirst` for map tiles)
- IndexedDB for the offline station-price cache; `localStorage` for settings
- Vitest for tests

## Deployment

Deployed to GitHub Pages at `/erregai/` (see `vite.config.ts` `base`). Pushing to `main`
builds and publishes `dist/` via `.github/workflows/deploy.yml`. Releases are cut by
`.github/workflows/release-please.yml` (release-please, `release-type: node`), which
opens a release PR and auto-merges it once checks pass.

## License

ISC
