import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
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
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
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
