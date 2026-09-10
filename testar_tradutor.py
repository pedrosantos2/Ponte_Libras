"""
Testa a lógica do tradutor em tempo real SEM webcam, simulando o fluxo de
frames com vídeos reais: sala vazia -> sinal -> sala vazia.

Verifica os dois problemas vistos ao vivo:
  1. falso positivo com a tela parada/vazia
  2. sinal "carona" disparado nas janelas de transição (ex.: OI + ABACAXI)

Compara configurações de filtro para calibrar threshold/estabilidade.
"""
import json
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from tensorflow.keras.models import load_model

from config import (
    COORD_SIZE, NUM_HANDS, MODELO_LSTM, LABELS_JSON, ensure_hand_landmarker,
)
from reconhecedor import ReconhecedorContinuo

CASOS = [  # (vídeo, glossa esperada)
    ("videos_baixados/oi/vlibrasil_art1_oi.mp4", "OI"),
    ("videos_baixados/abacaxi/vlibrasil_art2_abacaxi.mp4", "ABACAXI"),
    ("videos_baixados/amarelo/minds_s01_r1_amarelo.mp4", "AMARELO"),
    ("videos_baixados/banheiro/minds_s02_r1_banheiro.mp4", "BANHEIRO"),
    ("videos_baixados/medo/minds_s05_r2_medo.mp4", "MEDO"),
    # Sinais que o modelo NUNCA viu: devem virar silêncio (classe OUTRO)
    ("videos_baixados/_teste_desconhecido/vlibrasil_art1_telefone.mp4", "(nada)"),
    ("videos_baixados/_teste_desconhecido/vlibrasil_art1_dinheiro.mp4", "(nada)"),
]
CONFIGS = [  # (nome, threshold, estabilidade, min_frames, silencio, veto_outro)
    ("sem veto", 0.95, 8, 15, 15, 1.1),
    ("veto=0.30", 0.95, 8, 15, 15, 0.30),
    ("veto=0.15", 0.95, 8, 15, 15, 0.15),
    ("veto=0.05", 0.95, 8, 15, 15, 0.05),
]
FRAMES_VAZIOS = 45

model = load_model(MODELO_LSTM)
ACTIONS = json.load(open(LABELS_JSON, encoding='utf-8'))

base_options = mp_python.BaseOptions(model_asset_path=ensure_hand_landmarker())
detector = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
    base_options=base_options, running_mode=vision.RunningMode.IMAGE,
    num_hands=NUM_HANDS, min_hand_detection_confidence=0.7,
    min_hand_presence_confidence=0.7, min_tracking_confidence=0.5))


def coords_do_video(caminho):
    cap = cv2.VideoCapture(caminho)
    frames = []
    while True:
        ok, img = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        res = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
        c = np.zeros(COORD_SIZE)
        if res.hand_landmarks:
            pts = []
            for hand in res.hand_landmarks[:NUM_HANDS]:
                for lm in hand:
                    pts.extend([lm.x, lm.y, lm.z])
            c[:len(pts)] = pts
        frames.append(c)
    cap.release()
    return frames


print("Extraindo coordenadas dos vídeos de teste...")
fluxos = []
for video, esperado in CASOS:
    coords = coords_do_video(video)
    # simula: sala vazia -> sinal -> sala vazia
    fluxo = [np.zeros(COORD_SIZE)] * FRAMES_VAZIOS + coords + [np.zeros(COORD_SIZE)] * FRAMES_VAZIOS
    fluxos.append((esperado, fluxo, len(coords)))
    print(f"  {esperado:9s} {len(coords)} frames, {sum(1 for c in coords if c.any())} com mão")

# Caso extra: "parado" = a pose de descanso do início de um vídeo, repetida
descanso = [c for c in fluxos[2][1][FRAMES_VAZIOS:FRAMES_VAZIOS + 8]]
fluxo_parado = descanso * 12
fluxos.append(("(nada)", fluxo_parado, len(fluxo_parado)))
detector.close()

for nome, thr, estab, minf, sil, veto in CONFIGS:
    print(f"\n===== CONFIG: {nome}  (threshold={thr}, estabilidade={estab}, min_frames={minf}, silencio={sil}, veto={veto}) =====")
    total_ok, total_extras = 0, 0
    for esperado, fluxo, _ in fluxos:
        rec = ReconhecedorContinuo(model, ACTIONS, threshold=thr,
                                   estabilidade=estab, min_frames_com_mao=minf,
                                   silencio=sil, veto_outro=veto)
        for c in fluxo:
            rec.processar(c)
        gl = rec.glossas
        if esperado == "(nada)":
            ok = len(gl) == 0
            extras = len(gl)
        else:
            ok = esperado in gl
            extras = len([g for g in gl if g != esperado])
        total_ok += ok
        total_extras += extras
        status = "✅" if ok and extras == 0 else ("⚠️" if ok else "❌")
        print(f"  {status} esperado={esperado:9s} obtido={gl}")
    print(f"  -> acertos: {total_ok}/{len(fluxos)} | glossas indevidas: {total_extras}")
