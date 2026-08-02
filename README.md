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
- **Opening status**: stations that are closed right now, or about to close, are flagged in
  the list; the detail card shows the derived state next to the Ministerio's own text.
- **Fixed speed radars**: warned ahead in your direction of travel during a trip, and shown
  on the map with a browsable "nearby radars" list. Its own Settings toggle, separate from
  the alert sound.
- **Service areas** on the map as square markers, with the services inside them and, where
  the data exists, whether the restaurant is open. Its own Settings toggle.
- **Trip mode**: while the app is open and in the foreground, it tracks your heading and
  alerts you when a cheaper station appears ahead within your configured radius. It does
  **not** run in the background — see the caveat below.
- **Configurable default fuel** and trip radius, persisted locally.
- **Offline-first**: station data is cached in IndexedDB per province and served stale
  when the network is unavailable; the app itself is installable and works fully offline
  once loaded.
- **Six languages** — Spanish, English, Catalan, Basque, Valencian and Galician —
  following the browser/device language, or picked manually in Settings.

## Data

| Layer | Source | Licence | Refresh |
| --- | --- | --- | --- |
| Stations & prices | [Ministerio para la Transición Ecológica](https://www.mites.gob.es/) REST API | Public sector | Live per province, cached 6 h |
| Fixed radars | [DGT](https://nap.dgt.es/), [Servei Català de Trànsit](https://transit.gencat.cat/), [Trafikoa](https://apps.trafikoa.euskadi.eus/) | Open data | Bundled; cron on the 1st and 15th |
| Service areas | [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass](https://overpass-api.de/) | **ODbL** | Bundled; cron monthly |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL | Live |

No backend, no proxy, no data resale. The radar and service-area datasets are baked in at
build time, so both layers work offline and neither source is ever contacted from a user's
device.

Erregai is an independent client, not affiliated with or endorsed by any of these bodies.
OSM data is © OpenStreetMap contributors under the
[ODbL](https://opendatacommons.org/licenses/odbl/) — a share-alike licence on the
*database*, so `src/core/services.data.ts` carries the ODbL regardless of the MIT licence
on Erregai's own code.

### What the data does not cover

**Radars** — fixed cabins only: no mobile units, no section control, no crowdsourced
reports. Regions whose authority publishes nothing are under-represented, and the heading
cone can occasionally trigger on the far carriageway of a divided highway.

**Service areas** — 999 areas, 437 named, and only **141 publishing opening hours**. The
other 86% show no opening status at all: a missing schedule never becomes "closed". One
seasonal rule is deliberately left unmodelled rather than claim 24/7 through a summer
restriction. Amenities attach to the nearest area centre within 600 m instead of by polygon
geometry, so twin areas across a motorway can swap a restaurant. Rest areas
(`highway=rest_area`) are excluded.

### Regenerating the bundled datasets

```bash
npm run data:radars    # DGT + Catalunya + Euskadi
npm run data:services  # OpenStreetMap via Overpass
```

Both fetch server-side and fall back to local raw files under `../erregai-notes/` for
development; those raw files are not committed. Overpass requires an identifying
User-Agent — it answers `406` without one. The scheduled actions `update-radars.yml` and
`update-services.yml` re-run each generator and open a PR when a dataset changes.

## Alert cues

Radar and fuel alerts each have their own sound toggle, plus two shared controls in
Settings: an **alert volume** slider and a **vibration** toggle. The cues are synthesized
with the Web Audio API (no audio files): a double beep for radars, an ascending two-note
chime for stations, so the two are distinguishable without looking at the screen. The
"Test sound" buttons play the real cue at the configured volume, and also unlock audio —
mobile browsers only allow sound after a user gesture.

**If you cannot hear the alerts:** the cues play on the **media** channel, so they follow
media volume and compete with whatever the car stereo is playing. On **iOS, the hardware
mute switch silences Web Audio entirely**, whatever the in-app volume says. Vibration is a
fallback for exactly those cases, but the Vibration API is Android-only — iOS Safari does
not implement it, so on iPhone audio is the only cue.

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

MIT (see `LICENSE`). Note that the bundled OpenStreetMap dataset in
`src/core/services.data.ts` is a derivative database under the ODbL, not MIT.
