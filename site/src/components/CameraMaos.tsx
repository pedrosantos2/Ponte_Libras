import { useEffect, useRef, useState } from 'react'
import dados from '../data/mao-oi.json'

type Ponto = number[]
type Quadro = { maos: Ponto[][]; corpo: Ponto[] | null }

const quadros = dados.quadros as Quadro[]
const FPS = dados.fps

// Ligações entre os 21 pontos de cada mão, na convenção do MediaPipe
const LIGACOES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

const PAUSA_NO_FIM_S = 1.2
const QUADRO_ESTATICO = Math.round(quadros.length * 0.6)
// A saída aparece na parte final do vídeo, depois que o sinal foi feito
const INICIO_SAIDA = Math.round(quadros.length * 0.62)

const movimentoReduzido = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const p = (v: number) => (v * 100).toFixed(2)

export function CameraMaos() {
  const [rodando, setRodando] = useState(() => !movimentoReduzido())
  const [indice, setIndice] = useState(() => (movimentoReduzido() ? QUADRO_ESTATICO : 0))
  const tempo = useRef(0)

  useEffect(() => {
    if (!rodando) return
    let id = 0
    let anterior = performance.now()
    const duracao = quadros.length / FPS + PAUSA_NO_FIM_S
    const passo = (agora: number) => {
      // o carimbo do rAF pode ser anterior ao performance.now() do efeito
      tempo.current = (tempo.current + Math.max(0, agora - anterior) / 1000) % duracao
      anterior = agora
      setIndice(Math.min(quadros.length - 1, Math.max(0, Math.floor(tempo.current * FPS))))
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [rodando])

  const quadro = quadros[indice]
  const saidaVisivel = indice >= INICIO_SAIDA

  return (
    <figure className="camera">
      <div className="camera-tela">
        <svg
          viewBox="0 0 100 100"
          role="img"
          aria-label="Animação dos pontos das mãos de uma pessoa fazendo o sinal OI em Libras, como o sistema enxerga pela câmera"
        >
          {quadro.corpo && (
            <g stroke="#1fc1c8" strokeOpacity={0.35} strokeWidth={0.5} fill="none">
              <line x1={p(quadro.corpo[1][0])} y1={p(quadro.corpo[1][1])} x2={p(quadro.corpo[2][0])} y2={p(quadro.corpo[2][1])} />
              <circle cx={p(quadro.corpo[0][0])} cy={p(quadro.corpo[0][1])} r={2.2} />
            </g>
          )}
          {quadro.maos.map((mao, m) => (
            <g key={m}>
              <g stroke="#1fc1c8" strokeWidth={1} strokeLinecap="round">
                {LIGACOES.map(([a, b]) => (
                  <line key={`${a}-${b}`} x1={p(mao[a][0])} y1={p(mao[a][1])} x2={p(mao[b][0])} y2={p(mao[b][1])} />
                ))}
              </g>
              <g fill="#ffffff">
                {mao.map((pt, i) => (
                  <circle key={i} cx={p(pt[0])} cy={p(pt[1])} r={i === 0 ? 1.4 : 1} />
                ))}
              </g>
            </g>
          ))}
        </svg>

        <button
          type="button"
          className="camera-pausa"
          aria-pressed={!rodando}
          onClick={() => setRodando((r) => !r)}
        >
          {rodando ? 'Pausar' : 'Reproduzir'}
        </button>

        <div className="camera-saida" data-visivel={saidaVisivel} aria-hidden={!saidaVisivel}>
          <span className="glossa">OI</span>
          <span className="frase">“Oi!”</span>
        </div>
      </div>
      <figcaption>
        Pontos reais das mãos, do rosto e dos ombros, extraídos de um vídeo do sinal OI da base
        V-LIBRASIL. É isso que o modelo recebe, 30 vezes por segundo.
      </figcaption>
    </figure>
  )
}
