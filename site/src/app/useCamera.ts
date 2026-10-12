// A câmera do aplicativo: liga a webcam, extrai os 129 números de cada quadro
// novo, desenha as mãos e entrega o quadro a todos que estiverem ouvindo — a
// tradução e a gravação, ao mesmo tempo.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { ExtratorAoVivo } from './extracao'

export type Quadro = { coords: Float32Array; tSeg: number }
export type Ouvinte = (q: Quadro) => void
// pedindo: esperando a pessoa responder ao aviso de permissão do navegador
export type EstadoCamera = 'desligada' | 'pedindo' | 'carregando' | 'erro' | 'ligada'

// Ligações entre os 21 pontos de cada mão, na convenção do MediaPipe
const LIGACOES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]

function desenhar(tela: HTMLCanvasElement, maos: NormalizedLandmark[][], w: number, h: number) {
  if (tela.width !== w || tela.height !== h) {
    tela.width = w
    tela.height = h
  }
  const ctx = tela.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  const grossura = Math.max(2, w / 320)
  for (const mao of maos) {
    ctx.strokeStyle = 'rgba(31, 193, 200, 0.85)'
    ctx.lineWidth = grossura
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (const [a, b] of LIGACOES) {
      ctx.moveTo(mao[a].x * w, mao[a].y * h)
      ctx.lineTo(mao[b].x * w, mao[b].y * h)
    }
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    for (const p of mao) {
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, grossura * 1.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function mensagemDeErro(erro: unknown): string {
  const nome = erro instanceof DOMException ? erro.name : ''
  if (nome === 'NotAllowedError') return 'A câmera foi bloqueada. Libere o acesso nas configurações do navegador e tente de novo.'
  if (nome === 'NotFoundError') return 'Não encontrei nenhuma câmera neste aparelho.'
  if (nome === 'NotReadableError') return 'A câmera está sendo usada por outro programa. Feche-o e tente de novo.'
  return 'Não consegui ligar a câmera ou carregar o reconhecimento. Confira a internet e tente de novo.'
}

export function useCamera({ automatica = false } = {}) {
  const video = useRef<HTMLVideoElement>(null)
  const tela = useRef<HTMLCanvasElement>(null)
  const extrator = useRef<ExtratorAoVivo | null>(null)
  const criandoExtrator = useRef<Promise<ExtratorAoVivo> | null>(null)
  const fluxo = useRef<MediaStream | null>(null)
  const tentativa = useRef(0)
  const ouvintes = useRef(new Set<Ouvinte>())
  const [estado, setEstado] = useState<EstadoCamera>('desligada')
  const [erro, setErro] = useState('')
  const [proporcao, setProporcao] = useState(16 / 9)
  const [maosNaTela, setMaosNaTela] = useState(0)
  const [corpoNaTela, setCorpoNaTela] = useState(false)

  // Cada chamada é uma tentativa; quando a pessoa clica de novo antes da
  // anterior terminar, a velha se descarta sozinha depois de cada espera
  // (para a própria câmera e não mexe no estado), e nunca ficam duas câmeras.
  const ligar = useCallback(async () => {
    const minha = ++tentativa.current
    const atual = () => minha === tentativa.current
    let stream: MediaStream | null = null
    setErro('')
    try {
      const v = video.current!
      // Só em desenvolvimento: ?video=/caminho.mp4 usa um vídeo no lugar da
      // webcam, para testar o aplicativo onde não há câmera
      const teste = import.meta.env.DEV ? new URLSearchParams(location.search).get('video') : null
      if (teste) {
        v.src = teste
        v.loop = true
      } else {
        setEstado('pedindo')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        if (!atual()) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        fluxo.current?.getTracks().forEach((t) => t.stop())
        fluxo.current = stream
        v.srcObject = stream
        // webcam desconectada, permissão revogada, outro programa pegou a câmera
        const desta = stream
        desta.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (fluxo.current !== desta) return
          desta.getTracks().forEach((t) => t.stop())
          setErro('A câmera foi desligada. Ligue de novo para continuar.')
          setEstado('erro')
        })
      }
      setEstado('carregando')
      await v.play()
      if (!atual()) return
      setProporcao(v.videoWidth / v.videoHeight)
      criandoExtrator.current ??= ExtratorAoVivo.criar()
      extrator.current = await criandoExtrator.current
      if (!atual()) return
      // a câmera pode ter caído enquanto o modelo carregava
      if (stream && !stream.active) {
        setErro('A câmera foi desligada. Ligue de novo para continuar.')
        setEstado('erro')
        return
      }
      setEstado('ligada')
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop())
      if (!atual()) return
      criandoExtrator.current = extrator.current ? criandoExtrator.current : null
      console.error('Ponte Libras: não consegui ligar a câmera', e)
      setErro(mensagemDeErro(e))
      setEstado('erro')
    }
  }, [])

  // Pede a câmera assim que a página abre. A ref evita pedir duas vezes
  // (em desenvolvimento o React monta os componentes duas vezes de propósito).
  const pediu = useRef(false)
  useEffect(() => {
    if (!automatica || pediu.current) return
    pediu.current = true
    ligar()
  }, [automatica, ligar])

  useEffect(() => {
    if (estado !== 'ligada') return
    const v = video.current!
    const ext = extrator.current!
    let parar = false
    let ultimasMaos = -1
    let ultimoCorpo = false
    const quadro = () => {
      if (parar) return
      if (v.readyState >= 2) {
        const agora = performance.now()
        const { coords, maos, corpoVisivel } = ext.extrair(v, agora)
        desenhar(tela.current!, maos, v.videoWidth, v.videoHeight)
        if (maos.length !== ultimasMaos) setMaosNaTela((ultimasMaos = maos.length))
        if (corpoVisivel !== ultimoCorpo) setCorpoNaTela((ultimoCorpo = corpoVisivel))
        for (const o of ouvintes.current) o({ coords, tSeg: agora / 1000 })
      }
      // um quadro novo da câmera de cada vez (sem repetir o mesmo quadro)
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(quadro)
      else requestAnimationFrame(quadro)
    }
    quadro()
    const girou = () => v.videoWidth && setProporcao(v.videoWidth / v.videoHeight)
    v.addEventListener('resize', girou)
    return () => {
      parar = true
      v.removeEventListener('resize', girou)
    }
  }, [estado])

  useEffect(
    () => () => {
      fluxo.current?.getTracks().forEach((t) => t.stop())
      extrator.current?.fechar()
    },
    [],
  )

  // Quem quiser os quadros se inscreve aqui; a função devolvida cancela
  const ouvir = useCallback((o: Ouvinte) => {
    ouvintes.current.add(o)
    return () => {
      ouvintes.current.delete(o)
    }
  }, [])

  return { video, tela, estado, erro, proporcao, maosNaTela, corpoNaTela, ligar, ouvir }
}
