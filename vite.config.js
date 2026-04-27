import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,  // Different port from admin app (5173) so both can run together
    host: true,  // Expose on local network so we can test from the tablet
  },
})
