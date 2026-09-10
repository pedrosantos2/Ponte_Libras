import cv2
import mediapipe as mp
import numpy as np
import time
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from config import (
    ACTIONS, DATA_PATH, FRAME_COUNT, COORD_SIZE, NUM_HANDS,
    ensure_hand_landmarker,
)

# --- PREPARA AS PASTAS DO DATASET ---
for sign in ACTIONS:
    (DATA_PATH / sign).mkdir(parents=True, exist_ok=True)

# --- SETUP MEDIAPIPE ---
base_options = python.BaseOptions(model_asset_path=ensure_hand_landmarker())
options = vision.HandLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_hands=NUM_HANDS,  # 2 mãos, igual ao resto do pipeline (126 coords)
    min_hand_detection_confidence=0.7,
)
hand_landmarker = vision.HandLandmarker.create_from_options(options)

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

    image = cv2.flip(image, 1)
    image_h, image_w = image.shape[:2]
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    results = hand_landmarker.detect(mp_image)

    # Mesmo sem detecção, precisamos de zeros para manter o shape fixo da rede
    current_frame_landmarks = np.zeros(COORD_SIZE)

    if results.hand_landmarks:
        all_pts = []
        for hand_landmarks in results.hand_landmarks[:NUM_HANDS]:
            for lm in hand_landmarks:
                all_pts.extend([lm.x, lm.y, lm.z])
                # Desenha na tela para feedback
                x_px, y_px = int(lm.x * image_w), int(lm.y * image_h)
                cv2.circle(image, (x_px, y_px), 3, (0, 255, 0), -1)
        current_frame_landmarks[:len(all_pts)] = all_pts

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

    cv2.imshow('Coletor LIBRAS-SC', image)

    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'): break
    elif ord('1') <= key < ord('1') + len(ACTIONS):
        current_sign_idx = key - ord('1')
    elif key == ord('s') and not is_recording:
        print(f"🔴 Iniciando gravação de {ACTIONS[current_sign_idx]}...")
        is_recording = True

cap.release()
hand_landmarker.close()
cv2.destroyAllWindows()
