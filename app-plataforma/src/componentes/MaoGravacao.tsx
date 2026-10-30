// Mostra o que é uma gravação: os pontos das mãos de uma pessoa fazendo o
// sinal OI. A lógica foi copiada de site/src/components/CameraMaos.tsx (os
// dois sites são independentes) e mudou em três pontos: toca duas vezes e
// para, em vez de repetir sem fim; para no quadro do "I", o mesmo da marca;
// e a saída "Oi" fica sempre disponível para o leitor de tela.
// Carregada com React.lazy, para o formulário aparecer antes dela.
import { useEffect, useRef, useState } from 'react'
import dados from '../dados/mao-oi.json'
import { LIGACOES } from './Marca'

type Ponto = number[]
type Quadro = { maos: Ponto[][]; corpo: Ponto[] | null }

const quadros = dados.quadros as Quadro[]
const FPS = dados.fps
const PAUSA_NO_FIM_S = 1.2
const DURACAO_S = quadros.length / FPS + PAUSA_NO_FIM_S
const VOLTAS = 2
// o "I" do sinal, com o dedo mínimo levantado: o mesmo quadro da marca
const QUADRO_PARADO = 72
// a saída aparece na parte final do vídeo, depois que o sinal foi feito
const INICIO_SAIDA = Math.round(quadros.length * 0.62)

const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const p = (v: number) => (v * 100).toFixed(2)

export default function MaoGravacao() {
  const [rodando, setRodando] = useState(() => !movimentoReduzido())
  const [terminou, setTerminou] = useState(() => movimentoReduzido())
  const [indice, setIndice] = useState(() => (movimentoReduzido() ? QUADRO_PARADO : 0))
  const tempo = useRef(0)
  const voltas = useRef(0)

  useEffect(() => {
    if (!rodando) return
    let id = 0
    let anterior = performance.now()
    const passo = (agora: number) => {
      // o carimbo do rAF pode ser anterior ao performance.now() do efeito
      tempo.current += Math.max(0, agora - anterior) / 1000
      anterior = agora
      if (tempo.current >= DURACAO_S) {
        voltas.current += 1
        tempo.current -= DURACAO_S
        if (voltas.current >= VOLTAS) {
          setIndice(QUADRO_PARADO)
          setRodando(false)
          setTerminou(true)
          return
        }
      }
      setIndice(Math.min(quadros.length - 1, Math.floor(tempo.current * FPS)))
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [rodando])

  function alternar() {
    if (terminou) {
      tempo.current = 0
      voltas.current = 0
      setTerminou(false)
      setIndice(0)
      setRodando(true)
    } else {
      setRodando((r) => !r)
    }
  }

  const quadro = quadros[indice]
  const saidaVisivel = !rodando || indice >= INICIO_SAIDA

  return (
    <figure className="camera">
      <div className="camera-tela">
        {/* recorte em pé, só onde há pontos (x de 0,22 a 0,78; y de 0,05 a 0,95) */}
        <svg viewBox="16 2 68 96" role="img" aria-label="Mãos fazendo o sinal OI, vistas como pontos">
          {quadro.corpo && (
            <g stroke="var(--turquesa)" strokeOpacity={0.35} strokeWidth={0.5} fill="none">
              <line x1={p(quadro.corpo[1][0])} y1={p(quadro.corpo[1][1])} x2={p(quadro.corpo[2][0])} y2={p(quadro.corpo[2][1])} />
              <circle cx={p(quadro.corpo[0][0])} cy={p(quadro.corpo[0][1])} r={2.2} />
            </g>
          )}
          {quadro.maos.map((mao, m) => (
            <g key={m}>
              <g stroke="var(--turquesa)" strokeWidth={1} strokeLinecap="round">
                {LIGACOES.map(([a, b]) => (
                  <line key={`${a}-${b}`} x1={p(mao[a][0])} y1={p(mao[a][1])} x2={p(mao[b][0])} y2={p(mao[b][1])} />
                ))}
              </g>
              <g fill="var(--branco)">
                {mao.map((pt, i) => (
                  <circle key={i} cx={p(pt[0])} cy={p(pt[1])} r={i === 0 ? 1.4 : 1} />
                ))}
              </g>
            </g>
          ))}
        </svg>
        {/* embaixo dos pontos, para não cobrir as mãos nem o rosto */}
        <div className="camera-rodape">
          <p className="camera-saida" data-visivel={saidaVisivel}>
            <span className="glossa" aria-hidden="true">
              OI
            </span>
            <span className="frase">
              <span className="sr-only">Em português: </span>Oi
            </span>
          </p>
          <button type="button" className="camera-botao" onClick={alternar}>
            {terminou ? 'Ver a animação de novo' : rodando ? 'Pausar animação' : 'Continuar animação'}
          </button>
        </div>
      </div>
      <figcaption>
        Quando a gravação abrir, o Ponte Libras vai guardar só os pontos das mãos e do corpo, como nesta animação. O
        vídeo da câmera não sai do seu aparelho.
        <span className="credito">A animação usa um vídeo do sinal OI da base V-LIBRASIL.</span>
      </figcaption>
    </figure>
  )
}
