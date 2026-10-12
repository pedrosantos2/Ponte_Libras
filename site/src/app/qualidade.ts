// As mesmas checagens do recortar() do coletor_dados.py, com os mesmos
// limites, para a pessoa saber NA HORA se precisa gravar de novo. O recorte
// que vale para o treino continua sendo o do Python, quando a gravação é
// importada: aqui é só o aviso.
import { COORDS, MAOS } from './extracao'

export const FPS = 30
export const DURACAO_S = 4

// O roteiro do coletor_dados.py: uma contagem e 4 segundos guiados
export const PREPARO_S = 1.5
export const FASES = [
  { ate: 1, texto: 'Abaixe as mãos' },
  { ate: 3, texto: 'Faça o sinal agora' },
  { ate: 4, texto: 'Abaixe as mãos de novo' },
]
const QUADROS_JANELA = 30
const BUSCA_SINAL: [number, number] = [0.7, 3.3]
const MOVIMENTO_MINIMO = 25
const MIN_QUADROS_COM_MAO = QUADROS_JANELA / 2
const ALTURA_ROSTO = 0.8
const PONTOS_MAO = 63

export type Resultado = {
  erro: string
  aviso: string
  corpo: boolean
  quadrosComMao: number
  movimento: number
}

// Quadros em FPS irregular -> um a cada 1/30 s (vizinho mais próximo no tempo)
export function reamostrar(tempos: number[], quadros: Float32Array[]): Float32Array[] {
  const n = Math.round(DURACAO_S * FPS)
  const saida: Float32Array[] = []
  for (let i = 0; i < n; i++) {
    // como o np.argmin: o mais próximo, e no empate o primeiro
    const alvo = i / FPS
    let melhor = 0
    for (let k = 1; k < tempos.length; k++) if (Math.abs(tempos[k] - alvo) < Math.abs(tempos[melhor] - alvo)) melhor = k
    saida.push(quadros[melhor])
  }
  return saida
}

const temMao = (q: Float32Array, h: number) =>
  q.subarray(h * PONTOS_MAO, (h + 1) * PONTOS_MAO).some((v) => v !== 0)

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b)
  const m = v.length >> 1
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

function movimento(clipe: Float32Array[], ombros: number): number[] {
  const e = new Array(clipe.length).fill(0)
  for (let t = 1; t < clipe.length; t++) {
    for (let h = 0; h < 2; h++) {
      if (!temMao(clipe[t - 1], h) || !temMao(clipe[t], h)) continue
      for (let p = 0; p < 21; p++) {
        const i = h * PONTOS_MAO + p * 3
        e[t] += Math.abs(clipe[t][i] - clipe[t - 1][i]) + Math.abs(clipe[t][i + 1] - clipe[t - 1][i + 1])
      }
    }
    e[t] /= ombros
  }
  return e
}

function maoNoRosto(trecho: Float32Array[], narizY: number, ombros: number): number {
  let n = 0
  for (const q of trecho) {
    for (let h = 0; h < 2; h++) {
      if (temMao(q, h) && (q[h * PONTOS_MAO + 1] - narizY) / ombros < ALTURA_ROSTO) {
        n++
        break
      }
    }
  }
  return n / trecho.length
}

export function avaliar(clipe: Float32Array[], semMovimento: boolean): Resultado {
  const r: Resultado = { erro: '', aviso: '', corpo: false, quadrosComMao: 0, movimento: 0 }
  const comCorpo = clipe.filter((q) => q[COORDS - 1] > 0)
  if (!comCorpo.length) {
    r.erro = 'Não encontrei seu corpo na imagem. Fique de frente, com os ombros aparecendo.'
    return r
  }
  r.corpo = true
  const narizY = mediana(comCorpo.map((q) => q[MAOS + 1]))
  const ombros = mediana(comCorpo.map((q) => q[MAOS + 2]))

  if (semMovimento) {
    // OUTRO: os 4 segundos inteiros viram exemplos, sem procurar o sinal
    r.quadrosComMao = clipe.filter((q) => temMao(q, 0) || temMao(q, 1)).length
    return r
  }

  const e = movimento(clipe, ombros)
  const [ini, fim] = [Math.trunc(BUSCA_SINAL[0] * FPS), Math.trunc(BUSCA_SINAL[1] * FPS)]
  let melhor = -1
  let inicio = ini
  for (let i = ini; i + QUADROS_JANELA <= fim; i++) {
    let soma = 0
    for (let k = i; k < i + QUADROS_JANELA; k++) soma += e[k]
    if (soma >= melhor) [melhor, inicio] = [soma, i]
  }
  const janela = clipe.slice(inicio, inicio + QUADROS_JANELA)
  r.movimento = melhor
  r.quadrosComMao = janela.filter((q) => temMao(q, 0) || temMao(q, 1)).length

  if (melhor < MOVIMENTO_MINIMO) {
    r.erro = 'Não vi o movimento do sinal. Grave de novo, fazendo o sinal na fase do meio.'
  } else if (r.quadrosComMao < MIN_QUADROS_COM_MAO) {
    r.erro = 'Suas mãos quase não apareceram durante o sinal. Afaste-se um pouco da câmera.'
  } else if (
    maoNoRosto(clipe.slice(0, QUADROS_JANELA), narizY, ombros) > 0.4 ||
    maoNoRosto(clipe.slice(-QUADROS_JANELA), narizY, ombros) > 0.4
  ) {
    r.aviso = 'Dica: deixe as mãos abaixadas no começo e no fim.'
  }
  return r
}
