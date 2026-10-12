// Paridade com o extrator do Python (extracao.py): roda o MediaPipe do
// navegador sobre os mesmos frames PNG e grava o resultado em
// site/.paridade/web.json, que o testar_paridade_web.py compara.
//
// O vetor de cada frame vem de app/extracao.ts — o mesmo código da página
// de gravação, então a paridade medida aqui vale para o site.
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'
import { COORDS, corpoDe, vetor } from './app/extracao'

const BASE = '/paridade'
const DELEGATE = 'CPU' as const

type Modo = { conf: number; video: boolean }
const MODOS: Record<string, Modo> = {
  imagem: { conf: 0.5, video: false },
  video: { conf: 0.7, video: true },
}

type Video = { nome: string; n: number; fps: number }

const status = document.querySelector<HTMLPreElement>('#status')!
const log = (msg: string) => (status.textContent += msg + '\n')

function base64(dados: Float32Array): string {
  const bytes = new Uint8Array(dados.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

async function carregar(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = src
  await img.decode()
  return img
}

async function main() {
  const { videos } = (await (await fetch(`${BASE}/manifesto.json`)).json()) as { videos: Video[] }
  const arquivos = await FilesetResolver.forVisionTasks('/node_modules/@mediapipe/tasks-vision/wasm')
  const pose = await PoseLandmarker.createFromOptions(arquivos, {
    baseOptions: { modelAssetPath: `${BASE}/modelos/pose_landmarker_lite.task`, delegate: DELEGATE },
    runningMode: 'IMAGE',
  })

  const resultados: Record<string, string> = {}
  for (const video of videos) {
    const quadros: HTMLImageElement[] = []
    for (let i = 0; i < video.n; i++) {
      quadros.push(await carregar(`${BASE}/${video.nome}/${String(i).padStart(4, '0')}.png`))
    }

    for (const [nomeModo, modo] of Object.entries(MODOS)) {
      const maos = await HandLandmarker.createFromOptions(arquivos, {
        baseOptions: { modelAssetPath: `${BASE}/modelos/hand_landmarker.task`, delegate: DELEGATE },
        runningMode: modo.video ? 'VIDEO' : 'IMAGE',
        numHands: 2,
        minHandDetectionConfidence: modo.conf,
        minHandPresenceConfidence: modo.conf,
        minTrackingConfidence: 0.5,
      })
      const saida = new Float32Array(video.n * COORDS)
      quadros.forEach((img, i) => {
        // mesmo carimbo de tempo do Python: int(i * 1000 / fps)
        const r = modo.video ? maos.detectForVideo(img, Math.trunc((i * 1000) / video.fps)) : maos.detect(img)
        saida.set(vetor(r.landmarks, corpoDe(pose.detect(img).landmarks)), i * COORDS)
      })
      maos.close()
      resultados[`${video.nome}/${nomeModo}`] = base64(saida)
      log(`${video.nome} (${nomeModo}): ${video.n} frames`)
    }
  }
  pose.close()

  await fetch('/__paridade', {
    method: 'POST',
    body: JSON.stringify({ delegate: DELEGATE, resultados }),
  })
  log('terminou — resultado salvo em site/.paridade/web.json')
  document.title = 'paridade: pronto'
}

main().catch((erro) => {
  log(`ERRO: ${erro}`)
  document.title = 'paridade: erro'
})
