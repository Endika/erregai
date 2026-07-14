import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/erregai/',
  test: { globals: true, environment: 'node' },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Erregai',
        short_name: 'Erregai',
        theme_color: '#0b7285',
        background_color: '#0b7285',
        display: 'standalone',
        start_url: '/erregai/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // IndexedDB (src/adapters/cache.ts) is the primary data store; these
        // rules are the offline fallback for the service-worker cache only.
        runtimeCaching: [
          {
            // Official Ministerio province-prices API: prefer a fresh network
            // response, but fall back to the last cached one when offline.
            urlPattern: /^https:\/\/sedeaplicaciones\.minetur\.gob\.es\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'erregai-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OSM map tiles: static imagery, safe to serve from cache first.
            urlPattern: /^https:\/\/[a-z]\.tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'erregai-tile-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
