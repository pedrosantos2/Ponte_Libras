// Confere a LSTM de app/modelo.ts contra o Keras: refaz a normalização e a
// rede sobre as janelas de public/paridade/modelo_ref.json (geradas por
// testar_paridade_web.py modelo) e compara as probabilidades.
import { COORDS } from './app/extracao'
import { Modelo, normalizar } from './app/modelo'
import { Reconhecedor } from './app/reconhecedor'

const status = document.querySelector<HTMLPreElement>('#status')!

const decodificar = (b64: string) =>
  new Float32Array(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer)

async function main() {
  const modelo = await Modelo.carregar('/modelo/ponte-libras')
  const ref = (await (await fetch('/paridade/modelo_ref.json')).json()) as {
    n: number
    janelas: string
    probs: string
    validas: boolean[]
  }
  const janelas = decodificar(ref.janelas)
  const probs = decodificar(ref.probs)
  const { classes, quadros } = modelo.descricao
  const k = classes.length

  let validasIguais = 0
  let mesmaClasse = 0
  let comparadas = 0
  let maiorDif = 0
  const t0 = performance.now()
  for (let i = 0; i < ref.n; i++) {
    const janela = Array.from({ length: quadros }, (_, q) =>
      janelas.subarray((i * quadros + q) * COORDS, (i * quadros + q + 1) * COORDS),
    )
    const entrada = normalizar(janela)
    if ((entrada !== null) === ref.validas[i]) validasIguais++
    if (!entrada || !ref.validas[i]) continue
    const p = modelo.prever(entrada)
    const esperado = probs.subarray(i * k, (i + 1) * k)
    let a = 0
    let b = 0
    for (let j = 0; j < k; j++) {
      maiorDif = Math.max(maiorDif, Math.abs(p[j] - esperado[j]))
      if (p[j] > p[a]) a = j
      if (esperado[j] > esperado[b]) b = j
    }
    if (a === b) mesmaClasse++
    comparadas++
  }
  const ms = (performance.now() - t0) / ref.n

  // Reconhecimento contínuo: mesmo fluxo de quadros, mesmas glossas aceitas?
  const fluxo = (await (await fetch('/paridade/reconhecedor_ref.json')).json()) as {
    n: number
    quadros: string
    aceitas: { quadro: number; glossa: string }[]
  }
  const qs = decodificar(fluxo.quadros)
  const rec = new Reconhecedor(modelo)
  const aceitasWeb: { quadro: number; glossa: string }[] = []
  for (let i = 0; i < fluxo.n; i++) {
    const g = rec.processar(qs.subarray(i * COORDS, (i + 1) * COORDS), i / 30)
    if (g) aceitasWeb.push({ quadro: i, glossa: g })
  }
  const reconhecedorIgual = JSON.stringify(aceitasWeb) === JSON.stringify(fluxo.aceitas)

  status.textContent = JSON.stringify(
    {
      versao: modelo.descricao.versao, janelas: ref.n, validasIguais, comparadas, mesmaClasse, maiorDif, msPorJanela: ms,
      reconhecedorIgual, python: fluxo.aceitas, navegador: aceitasWeb,
    },
    null,
    1,
  )
  document.title = 'paridade do modelo: pronto'
}

main().catch((e) => {
  status.textContent = `ERRO: ${e}`
  document.title = 'paridade do modelo: erro'
})
