# Changelog

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
