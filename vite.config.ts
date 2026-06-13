import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB
      },
      manifest: {
        name: 'PEIE Tools',
        short_name: 'PEIETools',
        description: 'Gestión y Trazabilidad de Herramientas PEIE',
        theme_color: '#081A63',
        background_color: '#F8FAFC',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "es-toolkit/compat/range": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/range.js"),
      "es-toolkit/compat/get": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/get.js"),
      "es-toolkit/compat/omit": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/omit.js"),
      "es-toolkit/compat/maxBy": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/maxBy.js"),
      "es-toolkit/compat/sumBy": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/sumBy.js"),
      "es-toolkit/compat/sortBy": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/sortBy.js"),
      "es-toolkit/compat/throttle": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/throttle.js"),
      "es-toolkit/compat/minBy": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/minBy.js"),
      "es-toolkit/compat/last": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/last.js"),
      "es-toolkit/compat/isPlainObject": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/isPlainObject.js"),
      "es-toolkit/compat/uniqBy": path.resolve(__dirname, "./src/lib/es-toolkit-compat-shims/uniqBy.js"),
    },
  },
})
