// Configuração usada só pelo teste de paridade (npm run paridade): a mesma
// do site, mais uma rota que grava em disco o resultado enviado pela página
// paridade.html. Assim os números não passam pelo navegador à mão.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mergeConfig, type Plugin } from 'vite'
import site from './vite.config'

function salvarResultado(): Plugin {
  return {
    name: 'salvar-paridade',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__paridade', (req, res) => {
        const partes: Buffer[] = []
        req.on('data', (parte: Buffer) => partes.push(parte))
        req.on('end', () => {
          const pasta = resolve(server.config.root, '.paridade')
          mkdirSync(pasta, { recursive: true })
          writeFileSync(resolve(pasta, 'web.json'), Buffer.concat(partes))
          res.end('ok')
        })
      })
    },
  }
}

export default mergeConfig(site, { plugins: [salvarResultado()] })
