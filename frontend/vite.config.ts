import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Helps Vite pre-bundle chart deps consistently on some Windows setups.
  optimizeDeps: {
    include: ['recharts'],
  },
})
