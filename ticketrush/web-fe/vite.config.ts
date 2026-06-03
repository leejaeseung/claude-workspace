import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/queue': 'http://localhost:8081',
      '/seats': 'http://localhost:8082',
      '/orders': 'http://localhost:8083',
      '/payments': 'http://localhost:8084',
      '/sse': 'http://localhost:8085',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
