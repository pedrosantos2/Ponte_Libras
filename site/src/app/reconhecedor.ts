// O reconhecedor.py no navegador: transforma o fluxo de quadros da câmera em
// glossas, com os mesmos filtros contra falsos positivos e os mesmos valores
// do tradutor_final.py (estabilidade 8, mínimo de 15 quadros com mão).
//
// Tudo é medido em tempo: a janela é sempre o último 1 segundo, reamostrado
// para 30 quadros, então funciona em qualquer FPS de webcam.
import { MAOS } from './extracao'
import { normalizar, type Modelo } from './modelo'

const FPS_TREINO = 30

type Opcoes = { estabilidade: number; minQuadrosComMao: number; silencio: number; vetoOutro: number }
const PADRAO: Opcoes = { estabilidade: 8, minQuadrosComMao: 15, silencio: 15, vetoOutro: 0.2 }

export class Reconhecedor {
  glossas: string[] = []
  candidata = ''
  votos = 0
  confianca = 0
  readonly estabilidade: number

  private modelo: Modelo
  private opcoes: Opcoes
  private janelaS: number
  private idxOutro: number
  private buffer: { t: number; q: Float32Array }[] = []
  private ultima = ''
  private tCandidata = 0
  private silencioAte = -1

  constructor(modelo: Modelo, opcoes: Partial<Opcoes> = {}) {
    this.modelo = modelo
    this.opcoes = { ...PADRAO, ...opcoes }
    this.estabilidade = this.opcoes.estabilidade
    this.janelaS = modelo.descricao.quadros / FPS_TREINO
    this.idxOutro = modelo.descricao.classes.indexOf(modelo.descricao.classe_negativa)
  }

  limpar() {
    this.buffer = []
    this.glossas = []
    this.ultima = ''
    this.silencioAte = -1
    this.zerarCandidata()
    this.confianca = 0
  }

  // Depois de uma pausa (a gravação), recomeça a janela e a candidata sem
  // apagar as glossas já traduzidas: quadros de antes da pausa não podem
  // completar um sinal depois dela.
  reiniciarJanela() {
    this.buffer = []
    this.ultima = ''
    this.silencioAte = -1
    this.zerarCandidata()
    this.confianca = 0
  }

  private zerarCandidata() {
    this.candidata = ''
    this.votos = 0
  }

  // Último segundo reamostrado (vizinho mais próximo no tempo: interpolar
  // misturaria quadros com e sem mão detectada)
  private janela(t: number): Float32Array[] {
    const n = this.modelo.descricao.quadros
    const passo = this.janelaS / n
    const saida: Float32Array[] = []
    for (let k = 0; k < n; k++) {
      // como o np.argmin: o mais próximo, e no empate o primeiro
      const alvo = t - this.janelaS + (k + 1) * passo
      let melhor = 0
      for (let i = 1; i < this.buffer.length; i++) {
        if (Math.abs(this.buffer[i].t - alvo) < Math.abs(this.buffer[melhor].t - alvo)) melhor = i
      }
      saida.push(this.buffer[melhor].q)
    }
    return saida
  }

  // Um quadro (129 números) capturado no instante t, em segundos.
  // Devolve a glossa aceita, ou null.
  processar(q: Float32Array, t: number): string | null {
    const { descricao } = this.modelo
    this.buffer.push({ t, q })
    // guarda um pouco mais que a janela para a reamostragem ter borda
    while (this.buffer.length && this.buffer[0].t < t - this.janelaS - 0.2) this.buffer.shift()
    if (t - this.buffer[0].t < this.janelaS * 0.9) return null

    const janela = this.janela(t)
    const comMao = janela.filter((x) => x.subarray(0, MAOS).some((v) => v !== 0)).length
    if (comMao < this.opcoes.minQuadrosComMao) {
      // mãos fora da tela: zera o estado (permite repetir o mesmo sinal depois)
      this.zerarCandidata()
      this.confianca = 0
      this.ultima = ''
      return null
    }
    if (t < this.silencioAte) {
      this.zerarCandidata()
      return null
    }
    const entrada = normalizar(janela)
    if (!entrada) {
      this.zerarCandidata()
      return null
    }

    const p = this.modelo.prever(entrada)
    let idx = 0
    for (let i = 1; i < p.length; i++) if (p[i] > p[idx]) idx = i
    this.confianca = p[idx]
    if (this.confianca <= descricao.limiar) {
      this.zerarCandidata()
      return null
    }

    // variantes do mesmo sinal (OI e OI_ACENO) valem como a mesma glossa
    const glossa = descricao.glossas[descricao.classes[idx]]
    if (glossa === descricao.classe_negativa || (this.idxOutro >= 0 && p[this.idxOutro] > this.opcoes.vetoOutro)) {
      // "não é nenhum sinal que eu conheço": silêncio
      this.zerarCandidata()
      return null
    }

    if (glossa !== this.candidata) {
      this.candidata = glossa
      this.tCandidata = t
    }
    const decorrido = t - this.tCandidata
    this.votos = Math.min(this.opcoes.estabilidade, Math.trunc(decorrido * FPS_TREINO) + 1)
    if (decorrido >= this.opcoes.estabilidade / FPS_TREINO && this.candidata !== this.ultima) {
      this.glossas.push(this.candidata)
      this.ultima = this.candidata
      this.silencioAte = t + this.opcoes.silencio / FPS_TREINO
      return this.candidata
    }
    return null
  }
}
