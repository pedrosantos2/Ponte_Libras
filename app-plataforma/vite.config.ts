import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// A plataforma roda sozinha na porta 5174 (a landing, em site/, usa a 5173)
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
})
