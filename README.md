# Erregai

Nearby Spanish fuel stations with live prices. An offline-first web app: no backend, no accounts, no tracking.

**[Open the app →](https://endika.github.io/erregai/)**

## What it does

- **Prices near you**: stations within your radius, sorted by price or distance, each marked cheap, mid or dear against the others in that radius.
- **Map**: stations, fixed speed radars and motorway service areas.
- **Trip mode**: while you drive, it warns you of radars and cheaper stations ahead, in your direction of travel.
- **Works offline**: prices are cached, and radars and service areas ship with the app.
- **Six languages**: Spanish, Basque, Catalan, Valencian, Galician and English.

Trip mode only works with the app open on screen. On iPhone, the mute switch silences the alerts.

## Privacy

Your location never leaves your device. The app only calls the Ministerio price API and the OpenStreetMap tile servers. Settings and cached prices are stored locally.

## Data

| Data | Source | Licence |
| --- | --- | --- |
| Stations and prices | [Ministerio para la Transición Ecológica](https://www.mites.gob.es/) | Public sector |
| Fixed radars | [DGT](https://nap.dgt.es/), [Servei Català de Trànsit](https://transit.gencat.cat/), [Trafikoa](https://apps.trafikoa.euskadi.eus/) | Open data |
| Service areas | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL |
| Map tiles | [OpenStreetMap](https://www.openstreetmap.org/copyright) | ODbL |

Fixed radars only, with no mobile or section-control radars. Erregai is not affiliated with any of these sources.

## Development

```bash
npm install
npm run dev     # dev server
npm test        # tests
npm run build   # type check + production build
```

To refresh the bundled data: `npm run data:radars`, `npm run data:services` and `npm run data:places`. Radars and service areas are also refreshed by scheduled GitHub Actions. Euskadi radars can only be fetched from a Spanish connection.

## License

MIT. The bundled OpenStreetMap data (`src/core/services.data.ts`) is under the [ODbL](https://opendatacommons.org/licenses/odbl/).
