import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'NavBus – Track Your Bus',
        short_name: 'NavBus',
        description: 'Real-time bus tracking for Vellore',
        theme_color: '#15a8cd',
        background_color: '#036ea7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxAgeSeconds: 86400*365 } } },
          { urlPattern: /\/api\/(routes|buses|stops)/, handler: 'NetworkFirst',
            options: { cacheName: 'api', expiration: { maxAgeSeconds: 300 } } },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
