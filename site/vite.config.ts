import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativa: o build funciona em qualquer subcaminho (ex.: GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
})
