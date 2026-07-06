import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Dev only: the serverless /api/* functions live on Vercel, not the Vite dev
  // server. Proxy them to production so /app and /portal work locally (PIN fetch,
  // Stripe, food, messages, etc.). No effect on the built/deployed site.
  server: {
    proxy: {
      '/api': {
        target: 'https://portal.hexaspace.com.au',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
