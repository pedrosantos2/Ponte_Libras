import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Os testes de paridade (testar_paridade_web.py) guardam quadros dos vídeos
// das bases públicas em public/paridade, para as páginas de teste usarem em
// desenvolvimento. Esses dados não podem ir para o site publicado.
function semDadosDeTeste(): Plugin {
  let saida = 'dist'
  return {
    name: 'sem-dados-de-teste',
    apply: 'build',
    configResolved(config) {
      saida = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      rmSync(resolve(saida, 'paridade'), { recursive: true, force: true })
    },
  }
}

// base relativa: o build funciona em qualquer subcaminho (ex.: GitHub Pages)
export default defineConfig({
  plugins: [react(), semDadosDeTeste()],
  base: './',
})
