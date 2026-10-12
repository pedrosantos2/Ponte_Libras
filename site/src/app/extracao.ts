// Espelho de extracao.py no navegador. Cada quadro vira os mesmos 129
// números do Python: 2 mãos × 21 pontos × (x, y, z), mais nariz_x, nariz_y e
// a largura dos ombros. O testar_paridade_web.py confere que os dois lados
// geram os mesmos números (e o modelo, a mesma resposta) para os mesmos pixels.
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

export const COORDS = 129
export const MAOS = 126
const LARGURA_DETECCAO = 640
const NARIZ = 0
const OMBRO_E = 11
const OMBRO_D = 12

// A mesma versão do pacote instalado (package.json) e os mesmos modelos que o
// config.py baixa — pesos idênticos aos do treino.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm'
const MODELOS = 'https://storage.googleapis.com/mediapipe-models'
const MODELO_MAOS = `${MODELOS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
const MODELO_POSE = `${MODELOS}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`

export function vetor(maos: NormalizedLandmark[][], corpo: number[]): Float32Array {
  const v = new Float32Array(COORDS)
  let i = 0
  for (const mao of maos.slice(0, 2)) {
    for (const p of mao) {
      v[i++] = p.x
      v[i++] = p.y
      v[i++] = p.z
    }
  }
  v.set(corpo, MAOS)
  return v
}

export function corpoDe(pose: NormalizedLandmark[][]): number[] {
  if (!pose.length) return [0, 0, 0]
  const lm = pose[0]
  const ombros = Math.hypot(lm[OMBRO_E].x - lm[OMBRO_D].x, lm[OMBRO_E].y - lm[OMBRO_D].y)
  return [lm[NARIZ].x, lm[NARIZ].y, ombros]
}

// Igual ao Extrator(modo_video=True, conf_mao=0.7, pose_cada=2) do coletor:
// rastreia as mãos entre quadros e roda a pose a cada 2 quadros.
export class ExtratorAoVivo {
  private maos: HandLandmarker
  private pose: PoseLandmarker
  private reduzida = document.createElement('canvas')
  private n = 0
  private corpo = [0, 0, 0]
  private ultimoT = -1

  private constructor(maos: HandLandmarker, pose: PoseLandmarker) {
    this.maos = maos
    this.pose = pose
  }

  static async criar(): Promise<ExtratorAoVivo> {
    const arquivos = await FilesetResolver.forVisionTasks(WASM)
    const [maos, pose] = await Promise.all([
      HandLandmarker.createFromOptions(arquivos, {
        baseOptions: { modelAssetPath: MODELO_MAOS, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.5,
      }),
      PoseLandmarker.createFromOptions(arquivos, {
        baseOptions: { modelAssetPath: MODELO_POSE, delegate: 'CPU' },
        runningMode: 'IMAGE',
      }),
    ])
    return new ExtratorAoVivo(maos, pose)
  }

  extrair(video: HTMLVideoElement, agoraMs: number) {
    // como o Python, a detecção roda numa cópia com 640 px de largura
    const w = video.videoWidth
    const h = video.videoHeight
    const largura = Math.min(w, LARGURA_DETECCAO)
    const altura = Math.trunc((h * largura) / w)
    if (this.reduzida.width !== largura || this.reduzida.height !== altura) {
      this.reduzida.width = largura
      this.reduzida.height = altura
    }
    this.reduzida.getContext('2d')!.drawImage(video, 0, 0, largura, altura)

    // o modo vídeo exige carimbos de tempo sempre crescentes
    const t = Math.max(Math.round(agoraMs), this.ultimoT + 1)
    this.ultimoT = t
    const maos = this.maos.detectForVideo(this.reduzida, t).landmarks
    if (this.n % 2 === 0) this.corpo = corpoDe(this.pose.detect(this.reduzida).landmarks)
    this.n++
    return { coords: vetor(maos, this.corpo), maos, corpoVisivel: this.corpo[2] > 0 }
  }

  fechar() {
    this.maos.close()
    this.pose.close()
  }
}
