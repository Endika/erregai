# Changelog

## [1.13.0](https://github.com/Endika/erregai/compare/v1.12.0...v1.13.0) (2026-07-16)


### Features

* **settings:** add fuel test-sound button for parity with radar ([f281863](https://github.com/Endika/erregai/commit/f2818638452bf4e54c322812cdffbe2df229648c))

## [1.12.0](https://github.com/Endika/erregai/compare/v1.11.3...v1.12.0) (2026-07-16)


### Features

* **settings:** add radar test-sound button to verify audio on device ([6ae3312](https://github.com/Endika/erregai/commit/6ae3312d26a65fc527258fd008aa2f8f3f4e6513))

## [1.11.3](https://github.com/Endika/erregai/compare/v1.11.2...v1.11.3) (2026-07-15)


### Bug Fixes

* **ui:** pin app shell to viewport so header and tab bar stay fixed on mobile ([bfe5f8f](https://github.com/Endika/erregai/commit/bfe5f8f17385f6bb91bcc81fd5ec35f614f49eac))

## [1.11.2](https://github.com/Endika/erregai/compare/v1.11.1...v1.11.2) (2026-07-15)


### Refactor

* **settings:** group controls into general, radar and fuel sections ([ce7b9dc](https://github.com/Endika/erregai/commit/ce7b9dc97e857b2514a93d0dfebca37813210e4e))

## [1.11.1](https://github.com/Endika/erregai/compare/v1.11.0...v1.11.1) (2026-07-15)


### Bug Fixes

* **trip:** unlock shared audio context on start so alerts sound on mobile ([4124e13](https://github.com/Endika/erregai/commit/4124e13545f3947f4a4c6a8ca52f49432c8034e4))

## [1.11.0](https://github.com/Endika/erregai/compare/v1.10.1...v1.11.0) (2026-07-15)


### Features

* **radars:** add Euskadi (Trafikoa) radar source ([b1c099f](https://github.com/Endika/erregai/commit/b1c099f7e1f9a56ca6ea7665a90c2082d1166315))
* **radars:** add radar alert preferences to settings ([af1fed6](https://github.com/Endika/erregai/commit/af1fed61c08af82e754d410bcaf3fc94f4a96679))
* **radars:** add radar i18n notice and README data sources ([fcdf7a4](https://github.com/Endika/erregai/commit/fcdf7a47249c234500dd56668f1a9003bfb255bf))
* **radars:** add radar selection and alert-once logic ([c55d92b](https://github.com/Endika/erregai/commit/c55d92ba7efbe5b72659ebd9f074147145ad3181))
* **radars:** add synthesized audio beep adapter for alerts ([4cae52c](https://github.com/Endika/erregai/commit/4cae52c62b6e02eed18fbc354f7737e8654783ee))
* **radars:** alert on fixed radars ahead during trip mode ([db4170f](https://github.com/Endika/erregai/commit/db4170f21ba5c9e5b900bbe2af2de4b682dcb285))
* **radars:** build-time generator merging DGT, Euskadi and Catalonia datasets ([665c3fd](https://github.com/Endika/erregai/commit/665c3fd44af5939bd719530066036e6687e820a4))
* **radars:** show fixed radars on the trip map and nearby list ([f014936](https://github.com/Endika/erregai/commit/f0149363f7acc8b95620d182a33556016aa9fd35))
* **trip:** audible proximity alert for cheap fuel stations ahead ([1c3c6d9](https://github.com/Endika/erregai/commit/1c3c6d9f627f3fedabf45ffea574db9b6a63d19e))
* **trip:** keep screen awake while trip mode is active ([50c6b34](https://github.com/Endika/erregai/commit/50c6b3498c5475a7fe7eaaee07cedc5b471c2b9e))


### Chores

* **radars:** remove unused xlsx dep and bound DGT XML section slice ([d991705](https://github.com/Endika/erregai/commit/d9917051e971cebfbe75e26b43fa67dadf06a5c6))

## [1.10.1](https://github.com/Endika/erregai/compare/v1.10.0...v1.10.1) (2026-07-14)


### Chores

* bump actions/setup-node from 6 to 7 in the actions group ([1220519](https://github.com/Endika/erregai/commit/1220519f754cd4ad7df6640530cfb45deb1f7145))

## [1.10.0](https://github.com/Endika/erregai/compare/v1.9.0...v1.10.0) (2026-07-14)


### Features

* **ui:** GPS retry, refresh spinner, colour legend + data attribution, native maps deep-link ([02f9e45](https://github.com/Endika/erregai/commit/02f9e4511d517551ba9cc47ce8f37ff96ce7a833))

## [1.9.0](https://github.com/Endika/erregai/compare/v1.8.0...v1.9.0) (2026-07-14)


### Features

* **trip:** make the trip list tappable and sortable, defaulting to distance ([ceef542](https://github.com/Endika/erregai/commit/ceef542b0032380cbb89b53da16b6c39d6576fbc))

## [1.8.0](https://github.com/Endika/erregai/compare/v1.7.0...v1.8.0) (2026-07-14)


### Features

* **ui:** surface a price/distance sort toggle above the station list ([6c6ddb7](https://github.com/Endika/erregai/commit/6c6ddb7c1879166748dc76070836fac1d6fec555))

## [1.7.0](https://github.com/Endika/erregai/compare/v1.6.1...v1.7.0) (2026-07-14)


### Features

* **ui:** map+list split view, trip list distances, and light/system/dark theme ([4a66b4f](https://github.com/Endika/erregai/commit/4a66b4f43205b446254a25394bfc7292396b663e))

## [1.6.1](https://github.com/Endika/erregai/compare/v1.6.0...v1.6.1) (2026-07-14)


### Chores

* license under MIT to match sister apps ([f72a8c9](https://github.com/Endika/erregai/commit/f72a8c9a0ebddddf3da8ded70e3f0bbd7dd39695))

## [1.6.0](https://github.com/Endika/erregai/compare/v1.5.0...v1.6.0) (2026-07-14)


### Features

* **i18n:** add catalan, basque, valencian and galician locales ([3f1d246](https://github.com/Endika/erregai/commit/3f1d2461587aa8da6949fbbaf872b6d483ebbb39))

## [1.5.0](https://github.com/Endika/erregai/compare/v1.4.0...v1.5.0) (2026-07-14)


### Features

* **pwa:** add fuel-pump favicon and regenerate app icons to match ([e42d3a3](https://github.com/Endika/erregai/commit/e42d3a35fff20a870834133ecdbe6fa9369e6f1a))

## [1.4.0](https://github.com/Endika/erregai/compare/v1.3.0...v1.4.0) (2026-07-14)


### Features

* **ui:** highlight selected station in list and map with a detail card ([36b8c4a](https://github.com/Endika/erregai/commit/36b8c4a2510173b09dc05c004feeb9cecea52604))

## [1.3.0](https://github.com/Endika/erregai/compare/v1.2.0...v1.3.0) (2026-07-14)


### Features

* **trip:** zoom the map to street level on entering trip mode ([79a1e93](https://github.com/Endika/erregai/commit/79a1e9344ee7bef10df7924e6a87d2dbff22bbd6))

## [1.2.0](https://github.com/Endika/erregai/compare/v1.1.1...v1.2.0) (2026-07-14)


### Features

* **trip:** show a follow-me map in trip mode to guide navigation ([24f0ee6](https://github.com/Endika/erregai/commit/24f0ee61439bb46d7493cafbcd252419173850a2))

## [1.1.1](https://github.com/Endika/erregai/compare/v1.1.0...v1.1.1) (2026-07-14)


### Bug Fixes

* **ui:** bound app-shell to 100dvh so header and tab bar stay visible ([cd51947](https://github.com/Endika/erregai/commit/cd51947cc27579ebf9792dfd3669f456da374f6c))

## [1.1.0](https://github.com/Endika/erregai/compare/v1.0.0...v1.1.0) (2026-07-14)


### Features

* **adapter:** indexeddb province cache with ttl ([950313a](https://github.com/Endika/erregai/commit/950313aa356279316071874a05679bb9d9ca6288))
* **adapter:** official api province client ([e414727](https://github.com/Endika/erregai/commit/e414727f13ca495b432c0162edbae257bfed1705))
* **app:** observable store with cache-then-network loader ([aa5a8be](https://github.com/Endika/erregai/commit/aa5a8be565c95d8860a9db21636ec4554082ca7f))
* **core:** fuel catalog mapping ids to api keys ([4c11558](https://github.com/Endika/erregai/commit/4c11558e3117377ee7ee34cf916486283f0c2a7e))
* **core:** geo distance, bearing and corridor helpers ([dfbe44d](https://github.com/Endika/erregai/commit/dfbe44ddc403fcdd67caf24d0299d2598559665e))
* **core:** normalize raw api station records ([64b10e6](https://github.com/Endika/erregai/commit/64b10e638df23b7d6c7c6c6206ed29b195bb6188))
* **core:** offline province bbox lookup from gps ([cc77f55](https://github.com/Endika/erregai/commit/cc77f5559ebe05805bf8121b91450de096a6ba6b))
* **core:** station price sort and percentile colour band ([7e75b05](https://github.com/Endika/erregai/commit/7e75b0504ce87df1ffafaa7465ae6b75f3301bb3))
* **core:** trip cheapest-ahead corridor selector ([0ea5e92](https://github.com/Endika/erregai/commit/0ea5e929241e73ad71d2383d015c284ea2b7c02d))
* geolocation, notification adapters and settings store ([d57ba5c](https://github.com/Endika/erregai/commit/d57ba5ce97800d32cf59579e975bb8ca01b791fc))
* **i18n:** spanish and english locales ([7422a77](https://github.com/Endika/erregai/commit/7422a77d3d3a9f812fc06372526fc73edb126b5a))
* **trip:** foreground trip mode with cheapest-ahead alerts ([91dd986](https://github.com/Endika/erregai/commit/91dd986997d0e67e62e2178aec7e6fdd1efa6f46))
* **ui:** leaflet map with colour-coded station markers ([266df7f](https://github.com/Endika/erregai/commit/266df7ff11b79a1424a773abe6d5657a9cf4f164))
* **ui:** station list, detail and settings views ([30c4a92](https://github.com/Endika/erregai/commit/30c4a92e9880eea09e8e81c6fc95255de9d11a30))


### Bug Fixes

* **app:** do not clear load error when a sibling province succeeds ([328e74e](https://github.com/Endika/erregai/commit/328e74ed3b4a2e4a3da838f167f026ba8b503d78))
* **core:** reject out-of-Spain outlier stations in province bbox generation ([c91951b](https://github.com/Endika/erregai/commit/c91951be6735250133170ac0c74a55a2c8a5f3b5))


### Refactor

* radius-filter list/map, single-pass band thresholds, live locale selector, drop dead code ([0e8b5a4](https://github.com/Endika/erregai/commit/0e8b5a45b32b825b2d90cf6f6dfcfb618235f435))


### Chores

* initial commit ([46c757f](https://github.com/Endika/erregai/commit/46c757fe46e22c824bf162b1dfb26f9f44b8423b))
* pwa runtime caching, readme, pages and release-please ([5ee50ae](https://github.com/Endika/erregai/commit/5ee50aee1261cd62191290978177a494951d1157))
* scaffold vite ts pwa project ([0f9fda4](https://github.com/Endika/erregai/commit/0f9fda4d6a70a5a4f283bb005da27e3f2515ffcd))
