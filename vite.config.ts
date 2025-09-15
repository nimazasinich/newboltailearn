import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5137,
    strictPort: true,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true, ws: true }
    }
  },
  preview: { port: 5137, strictPort: true }
})