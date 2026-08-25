import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'RooServ',
        short_name: 'RooServ',
        description: 'Serviços em Rondonópolis',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#020617',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      }
    })
  ],
  resolve: {
    alias: {
      '@servicos/shared': path.resolve(import.meta.dirname, '../../packages/shared/src'),
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
