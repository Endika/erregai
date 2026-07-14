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
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
