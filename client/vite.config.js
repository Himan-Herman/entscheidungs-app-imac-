import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,mp4}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },

      manifest: {
        id: '/',
        name: 'MedScoutX',
        short_name: 'MedScoutX',
        description:
          'Multilingual doctor visit preparation and medical communication support.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'browser'],
        orientation: 'any',
        background_color: '#f8fafc',
        theme_color: '#0f766e',
        categories: ['health', 'productivity'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          // TODO(maskable): Add a dedicated safe-zone maskable icon (512+) — current asset may clip on Android adaptive icons.
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],

  // 👇 DEV-Server bleibt UNVERÄNDERT
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // `npm run preview` — gleicher API-Proxy wie im Dev-Server (Backend auf :3000 starten).
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
