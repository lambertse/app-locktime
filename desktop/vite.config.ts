import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        // Entry for the Electron main process.
        // vite-plugin-electron compiles this with esbuild, watches for changes,
        // and auto-restarts Electron — no separate tsc step needed in dev.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // @lambertse/ibridger is CJS-only (no ESM export). Externalizing
              // it lets Electron require() it from node_modules at runtime
              // instead of trying to bundle it as ESM.
              // Native addons and CJS-only packages must not be bundled —
              // Electron requires them at runtime from node_modules.
              external: ['@lambertse/ibridger', '@vscode/spdlog'],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts'),
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8090,
  },
  build: {
    outDir: 'dist',
  },
  base: './',

  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/generated/**', 'src/main.tsx'],
    },
  },
})
