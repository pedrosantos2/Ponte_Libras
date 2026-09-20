import cv2
import numpy as np
import time

from config import ACTIONS, DATA_PATH, FRAME_COUNT
from extracao import Extrator

# --- PREPARA AS PASTAS DO DATASET ---
for sign in ACTIONS:
    (DATA_PATH / sign).mkdir(parents=True, exist_ok=True)

# --- EXTRATOR (mãos + referência do corpo, igual ao resto do pipeline) ---
extrator = Extrator(conf_mao=0.7)

# --- VARIÁVEIS DE ESTADO ---
cap = cv2.VideoCapture(0)
current_sign_idx = 0
is_recording = False
frame_counter = 0
sequence_data = []

print("\n--- COMANDOS ---")
for i, sign in enumerate(ACTIONS):
    print(f"{i + 1}: {sign}")
print(f"S: Gravar sequência de {FRAME_COUNT} frames")
print("Q: Sair\n")

while cap.isOpened():
    success, image = cap.read()
    if not success: break

    image_h, image_w = image.shape[:2]
    # As coordenadas saem da imagem ORIGINAL (mesma orientação dos vídeos de
    # treino); o espelho é só para a tela ficar natural para quem sinaliza
    current_frame_landmarks, maos = extrator.extrair(image)
    image = cv2.flip(image, 1)

    # Desenha na tela para feedback
    for mao in maos:
        for lm in mao:
            cv2.circle(image, (int((1 - lm.x) * image_w), int(lm.y * image_h)), 3, (0, 255, 0), -1)

    # --- LÓGICA DE GRAVAÇÃO ---
    if is_recording:
        sequence_data.append(current_frame_landmarks)
        frame_counter += 1

        # Feedback visual de gravação
        cv2.putText(image, f"GRAVANDO: {frame_counter}/{FRAME_COUNT}", (50, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        if frame_counter >= FRAME_COUNT:
            timestamp = int(time.time())
            file_name = DATA_PATH / ACTIONS[current_sign_idx] / f"seq_{timestamp}.npy"
            np.save(file_name, np.array(sequence_data))
            print(f"✅ Salvo: {file_name}")

            is_recording = False
            frame_counter = 0
            sequence_data = []

    # Interface na tela
    cv2.putText(image, f"SINAL ATUAL: {ACTIONS[current_sign_idx]}", (50, image_h - 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    cv2.imshow('Ponte Libras - Coletor', image)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'): break
    elif ord('1') <= key < ord('1') + len(ACTIONS):
        current_sign_idx = key - ord('1')
    elif key == ord('s') and not is_recording:
        print(f"🔴 Iniciando gravação de {ACTIONS[current_sign_idx]}...")
        is_recording = True

cap.release()
extrator.close()
cv2.destroyAllWindows()
