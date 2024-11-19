import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      outDir: 'build',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png', 'assets/images/*', 'components/**/*'],
      manifest: {
        short_name: 'radio-app',
        name: 'My Progressive Web Radio App',
        icons: [
          {
            src: 'assets/images/android-icon-192x192.png',
            type: 'image/png',
            sizes: '192x192'
          },
          {
            src: 'assets/images/apple-icon.png',
            type: 'image/png',
            sizes: '512x512'
          }
        ],
        start_url: '/',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#ffffff'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,tsx,ts,jsx}'],
        runtimeCaching: [
          {
            urlPattern: /.*\.mp3/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mp3-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      }
    })
  ],
  build: {
    outDir: 'build',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    },
    copyPublicDir: true
  },
  publicDir: 'public'
});