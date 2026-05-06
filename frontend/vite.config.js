import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Permitir cualquier host para evitar bloqueos en la demo
    allowedHosts: true, 
    hmr: {
      // El navegador se conecta al 80, pero Vite escucha en el 5173
      clientPort: 80,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:10000',
        changeOrigin: true,
        ws: true,
      }
    }
  }
})
