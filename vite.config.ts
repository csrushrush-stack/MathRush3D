import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  resolve: {
    // Guarantee a single copy of these packages across all nested deps
    dedupe: ['react', 'react-dom', 'zustand', 'three'],
  },
})
