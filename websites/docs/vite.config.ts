import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// https://vite.dev/config/
const rootDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(rootDir, 'src'),
      react: path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'node_modules/react'),
      'react-dom': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [rootDir],
    },
  },
})
