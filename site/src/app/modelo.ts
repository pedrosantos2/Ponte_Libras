// A LSTM do Ponte Libras rodando no navegador, sem biblioteca de IA: os pesos
// vêm de exportar_modelo_web.py e a conta de cada camada está escrita aqui.
// O testar_paridade_web.py (subcomando "modelo") confere que as
// probabilidades batem com as do Keras.
import { MAOS } from './extracao'

type Peso = { forma: number[]; inicio: number; tamanho: number }
type Camada =
  | { tipo: 'lstm'; unidades: number; sequencias: boolean; pesos: Peso[] }
  | { tipo: 'densa'; unidades: number; ativacao: 'relu' | 'softmax'; pesos: Peso[] }

export type Descricao = {
  versao: string
  classes: string[]
  glossas: Record<string, string>
  classe_negativa: string
  limiar: number
  quadros: number
  entradas: number
  camadas: Camada[]
}

const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

// Uma LSTM do Keras: z = x·W + h·U + b, portas na ordem entrada, esquecimento,
// candidata e saída. Recebe a sequência inteira e devolve a sequência de
// estados (ou só o último).
function lstm(seq: Float32Array[], W: Float32Array, U: Float32Array, b: Float32Array, n: number, todas: boolean) {
  const entradas = seq[0].length
  let h = new Float32Array(n)
  const c = new Float32Array(n)
  const z = new Float32Array(4 * n)
  const saida: Float32Array[] = []
  for (const x of seq) {
    z.set(b)
    for (let i = 0; i < entradas; i++) {
      const xi = x[i]
      if (xi === 0) continue
      const linha = i * 4 * n
      for (let j = 0; j < 4 * n; j++) z[j] += xi * W[linha + j]
    }
    for (let i = 0; i < n; i++) {
      const hi = h[i]
      if (hi === 0) continue
      const linha = i * 4 * n
      for (let j = 0; j < 4 * n; j++) z[j] += hi * U[linha + j]
    }
    const novo = new Float32Array(n)
    for (let j = 0; j < n; j++) {
      const entrada = sigmoide(z[j])
      const esquece = sigmoide(z[n + j])
      const candidata = Math.tanh(z[2 * n + j])
      const sai = sigmoide(z[3 * n + j])
      c[j] = esquece * c[j] + entrada * candidata
      novo[j] = sai * Math.tanh(c[j])
    }
    h = novo
    if (todas) saida.push(h)
  }
  return todas ? saida : [h]
}

function densa(x: Float32Array, W: Float32Array, b: Float32Array, n: number, ativacao: string) {
  const y = new Float32Array(b)
  for (let i = 0; i < x.length; i++) {
    const linha = i * n
    for (let j = 0; j < n; j++) y[j] += x[i] * W[linha + j]
  }
  if (ativacao === 'relu') {
    for (let j = 0; j < n; j++) y[j] = Math.max(0, y[j])
  } else {
    const maior = Math.max(...y)
    let soma = 0
    for (let j = 0; j < n; j++) soma += y[j] = Math.exp(y[j] - maior)
    for (let j = 0; j < n; j++) y[j] /= soma
  }
  return y
}

export class Modelo {
  readonly descricao: Descricao
  private pesos: Float32Array

  private constructor(descricao: Descricao, pesos: Float32Array) {
    this.descricao = descricao
    this.pesos = pesos
  }

  static async carregar(base = './modelo/ponte-libras'): Promise<Modelo> {
    const [descricao, binario] = await Promise.all([
      fetch(`${base}.json`).then((r) => r.json() as Promise<Descricao>),
      fetch(`${base}.bin`).then((r) => r.arrayBuffer()),
    ])
    return new Modelo(descricao, new Float32Array(binario))
  }

  private peso(p: Peso) {
    return this.pesos.subarray(p.inicio, p.inicio + p.tamanho)
  }

  // entrada: os quadros já normalizados (quadros × 126)
  prever(entrada: Float32Array[]): Float32Array {
    let seq = entrada
    let vetor: Float32Array = new Float32Array(0)
    for (const camada of this.descricao.camadas) {
      const [W, U, b] = camada.pesos.map((p) => this.peso(p))
      if (camada.tipo === 'lstm') {
        seq = lstm(seq, W, U, b, camada.unidades, camada.sequencias)
        vetor = seq[seq.length - 1]
      } else {
        vetor = densa(vetor, W, U, camada.unidades, camada.ativacao)
      }
    }
    return vetor
  }
}

// ---------- normalizar_sequencia do config.py ----------
const PONTOS_MAO = 63

function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b)
  const m = v.length >> 1
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

// Mão com o pulso mais à esquerda primeiro; mão única sempre na 1ª metade
function ordenarMaos(q: Float32Array): Float32Array {
  const maos = [0, 1]
    .map((h) => q.subarray(h * PONTOS_MAO, (h + 1) * PONTOS_MAO))
    .filter((m) => m.some((v) => v !== 0))
    .sort((a, b) => a[0] - b[0])
  const saida = new Float32Array(MAOS)
  maos.forEach((m, h) => saida.set(m, h * PONTOS_MAO))
  return saida
}

// Quadros crus (× 129) -> entrada da rede (× 126), ou null sem corpo detectado.
// Cada ponto das mãos passa a ser medido a partir do nariz, em larguras de
// ombro: é o que dá ao modelo a LOCAÇÃO do sinal.
export function normalizar(janela: Float32Array[]): Float32Array[] | null {
  const comCorpo = janela.filter((q) => q[MAOS + 2] > 0)
  if (!comCorpo.length) return null
  const narizX = mediana(comCorpo.map((q) => q[MAOS]))
  const narizY = mediana(comCorpo.map((q) => q[MAOS + 1]))
  const ombros = mediana(comCorpo.map((q) => q[MAOS + 2]))
  return janela.map((q) => {
    const m = ordenarMaos(q)
    for (let h = 0; h < 2; h++) {
      const ini = h * PONTOS_MAO
      if (!m.subarray(ini, ini + PONTOS_MAO).some((v) => v !== 0)) continue
      for (let p = ini; p < ini + PONTOS_MAO; p += 3) {
        m[p] = (m[p] - narizX) / ombros
        m[p + 1] = (m[p + 1] - narizY) / ombros
        m[p + 2] = m[p + 2] / ombros
      }
    }
    return m
  })
}
