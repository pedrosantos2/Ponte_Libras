import json
import sys
import cv2
import mediapipe as mp
import numpy as np
import requests
from pathlib import Path
from tensorflow.keras.models import load_model
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from config import (
    COORD_SIZE, NUM_HANDS, THRESHOLD,
    MODELO_LSTM, LABELS_JSON, OLLAMA_URL, OLLAMA_MODEL,
    ensure_hand_landmarker,
)
from reconhecedor import ReconhecedorContinuo

# --- CARREGA O MODELO E AS CLASSES DO TREINO ---
if not Path(MODELO_LSTM).exists() or not Path(LABELS_JSON).exists():
    print("❌ Modelo não encontrado. Rode primeiro: python treinal_modelo.py")
    sys.exit(1)

model_lstm = load_model(MODELO_LSTM)

# A ordem das classes vem do arquivo salvo NO TREINO — assim a predição
# (que é só um índice) sempre aponta para o nome certo.
with open(LABELS_JSON, encoding='utf-8') as f:
    ACTIONS = json.load(f)

# --- FUNÇÃO OLLAMA ---
def chamar_gemma(glossas):
    if not glossas: return ""
    prompt = f"Converta estas glossas de LIBRAS para português fluído: {' '.join(glossas)}"
    try:
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        return response.json().get('response', "Erro na resposta").strip()
    except Exception as e:
        return f"Erro: {e}"

# --- SETUP MEDIAPIPE ---
base_options = python.BaseOptions(model_asset_path=ensure_hand_landmarker())
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=NUM_HANDS,
    min_hand_detection_confidence=0.7,
    min_hand_presence_confidence=0.7,
    min_tracking_confidence=0.5,
)
hand_landmarker = vision.HandLandmarker.create_from_options(options)

# --- RECONHECEDOR CONTÍNUO (filtros contra falsos positivos) ---
# A lógica de decisão mora em reconhecedor.py, compartilhada com os testes.
rec = ReconhecedorContinuo(model_lstm, ACTIONS, estabilidade=8, min_frames_com_mao=15)

# --- VARIÁVEIS DE ESTADO ---
cap = cv2.VideoCapture(0)
traducao_final_tela = "Aguardando sinais..."

print("\n🚀 SISTEMA RODANDO - LIBRAS-SC")
print(f"Sinais conhecidos: {', '.join(ACTIONS)}")
print("Espaço: Traduzir (Gemma) | C: Limpar Tela | Q: Sair\n")

while cap.isOpened():
    success, image = cap.read()
    if not success: break

    image = cv2.flip(image, 1)
    image_h, image_w = image.shape[:2]
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    results = hand_landmarker.detect(mp_image)

    current_coords = np.zeros(COORD_SIZE)

    if results.hand_landmarks:
        all_pts = []
        for hand_landmarks in results.hand_landmarks[:NUM_HANDS]:
            for lm in hand_landmarks:
                all_pts.extend([lm.x, lm.y, lm.z])
                # Feedback visual dos pontos
                x_px, y_px = int(lm.x * image_w), int(lm.y * image_h)
                cv2.circle(image, (x_px, y_px), 3, (0, 255, 0), -1)

        current_coords[:len(all_pts)] = all_pts

    rec.processar(current_coords)

    # ==========================================
    # INTERFACE VISUAL (HUD)
    # ==========================================

    # 1. Barra Inferior (As Glossas Detectadas)
    cv2.rectangle(image, (0, image_h-40), (image_w, image_h), (30, 30, 30), -1)
    texto_glossas = " > ".join(rec.glossas)
    cv2.putText(image, f"Sinais: {texto_glossas}", (15, image_h-12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    # 1b. Termômetro de confiança: o que o modelo está "pensando" agora.
    # Verde = passou do threshold (contando votos); cinza = abaixo, ignorado.
    if rec.conf_atual > 0:
        cor = (0, 220, 0) if rec.conf_atual > THRESHOLD else (140, 140, 140)
        largura = int((image_w - 30) * rec.conf_atual)
        cv2.rectangle(image, (15, image_h-58), (15 + largura, image_h-48), cor, -1)
        cv2.putText(image, f"{rec.candidata or '...'} {rec.conf_atual:.0%} ({rec.votos}/{rec.estabilidade})",
                    (15, image_h-64), cv2.FONT_HERSHEY_SIMPLEX, 0.5, cor, 1)

    # 2. Barra Superior (A Tradução do Gemma)
    cv2.rectangle(image, (0, 0), (image_w, 50), (160, 40, 40), -1)
    cv2.putText(image, f"Gemma: {traducao_final_tela}", (15, 33),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    cv2.imshow('Tradutor Final LIBRAS-SC', image)

    # --- CONTROLES DO TECLADO ---
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'):
        rec.limpar()
        traducao_final_tela = "Aguardando sinais..."
    elif key == ord(' '):
        # Avisa na tela que está processando antes da chamada (que é lenta)
        traducao_final_tela = "Processando IA... aguarde."
        cv2.putText(image, f"Gemma: {traducao_final_tela}", (15, 33),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.imshow('Tradutor Final LIBRAS-SC', image)
        cv2.waitKey(1)  # Força atualização da tela

        frase = chamar_gemma(rec.glossas)
        traducao_final_tela = frase

        # Limpa o buffer de sinais para a próxima frase
        rec.limpar()

cap.release()
hand_landmarker.close()
cv2.destroyAllWindows()
