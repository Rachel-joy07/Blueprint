import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // In dev, point this at your Azure Function (func start default: 7071)
      '/api': 'http://localhost:7071'
    }
  }
})
